import { InvalidTransitionError, NotFoundError } from '../../shared/errors.js';
import { db } from '../../shared/database.js';
import { deploymentRepository } from './deployment.repository.js';
import { summarizeDiff, type DeploymentDiff } from '../../shared/git-diff.js';
import { webhookOutboundService } from '../webhook-outbound/webhook-outbound.service.js';
import { auditService } from '../audit/audit.service.js';
import type { Deployment, DeploymentVulnerability } from '@prisma/client';

interface DeploymentWithRelations extends Deployment {
  application: { id: string; name: string };
  environment: { id: string; name: string; type: string; namespace: string };
}

const DEPLOYMENT_STATUS_FLOW: Record<string, string[]> = {
  pending: ['building', 'cancelled', 'failed'],
  building: ['deploying', 'failed', 'cancelled'],
  deploying: ['healthy', 'failed', 'cancelled'],
  healthy: ['rolled_back'],
  rolled_back: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return DEPLOYMENT_STATUS_FLOW[from]?.includes(to) ?? false;
}

export const deploymentService = {
  async list(): Promise<Deployment[]> {
    return deploymentRepository.findAll();
  },

  async getLatestVersion(applicationId?: string): Promise<string | null> {
    if (!applicationId) return null;
    const latest = await deploymentRepository.findLatestByApplication(applicationId);
    return latest?.version ?? null;
  },

  async getById(id: string): Promise<Deployment> {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    return deployment;
  },

  async create(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
    trigger?: string;
    status?: string;
  }): Promise<Deployment> {
    const result = await deploymentRepository.create(data);
    auditService
      .log({
        action: 'CREATE',
        resource: 'Deployment',
        resourceId: result.id,
        details: { ...data, status: result.status } as Record<string, unknown>,
      })
      .catch(() => {});
    return result;
  },

  async transitionStatus(id: string, newStatus: string): Promise<Deployment> {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);

    const current = deployment.status;
    if (!canTransition(current, newStatus)) {
      throw new InvalidTransitionError(current, newStatus);
    }

    const completedAt = ['healthy', 'failed', 'rolled_back', 'cancelled'].includes(newStatus)
      ? new Date()
      : undefined;

    const updated = await deploymentRepository.updateStatus(id, newStatus, completedAt);

    auditService
      .log({
        action: 'TRANSITION',
        resource: 'Deployment',
        resourceId: id,
        details: { from: current, to: newStatus } as Record<string, unknown>,
      })
      .catch(() => {});

    const full = await db.deployment.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, name: true } },
        environment: { select: { id: true, name: true, type: true } },
      },
    });

    if (full) {
      const eventMap: Record<
        string,
        'started' | 'success' | 'failure' | 'rolled_back' | 'cancelled'
      > = {
        healthy: 'success',
        rolled_back: 'rolled_back',
        failed: 'failure',
        cancelled: 'cancelled',
      };
      webhookOutboundService
        .dispatch(eventMap[newStatus] ?? 'started', {
          applicationId: full.application.id,
          applicationName: full.application.name,
          version: full.version,
          environmentName: full.environment.name,
          environmentType: full.environment.type,
          commitSha: full.commitSha,
          deploymentId: full.id,
        })
        .catch(() => {});
    }

    return updated;
  },

  async approve(id: string, approvedById: string): Promise<Deployment> {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    if (deployment.status !== 'pending') {
      throw new InvalidTransitionError(deployment.status, 'deploying');
    }
    const result = await deploymentRepository.approve(id, approvedById);
    auditService
      .log({
        action: 'APPROVE',
        resource: 'Deployment',
        resourceId: id,
        details: { approvedById } as Record<string, unknown>,
      })
      .catch(() => {});
    return result;
  },

  async promote(id: string, targetEnvType: 'staging' | 'prod'): Promise<Deployment> {
    const source = await deploymentRepository.findById(id);
    if (!source) throw new NotFoundError('Deployment', id);
    if (source.status !== 'healthy') {
      throw new InvalidTransitionError(source.status, 'promote');
    }

    const target = await db.environment.findFirst({
      where: { applicationId: source.applicationId, type: targetEnvType },
    });
    if (!target) {
      throw new NotFoundError(`Environment (type=${targetEnvType})`, source.applicationId);
    }

    const result = await deploymentRepository.create({
      applicationId: source.applicationId,
      environmentId: target.id,
      version: source.version,
      commitSha: source.commitSha,
      trigger: 'manual',
      status: target.requiresApproval ? 'pending' : 'building',
    });
    auditService
      .log({
        action: 'PROMOTE',
        resource: 'Deployment',
        resourceId: result.id,
        details: { sourceId: id, targetEnvType } as Record<string, unknown>,
      })
      .catch(() => {});
    return result;
  },

  async recordViolations(id: string, violations: Record<string, unknown>[]): Promise<Deployment> {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    return deploymentRepository.savePolicyViolations(id, violations);
  },

  async getVulnerabilities(id: string): Promise<DeploymentVulnerability[]> {
    return db.deploymentVulnerability.findMany({
      where: { deploymentId: id },
      orderBy: { detectedAt: 'desc' },
    });
  },

  async compare(fromId: string, toId: string): Promise<DeploymentDiff> {
    const [from, to] = await Promise.all([
      this.getById(fromId) as Promise<DeploymentWithRelations>,
      this.getById(toId) as Promise<DeploymentWithRelations>,
    ]);
    if (from.applicationId !== to.applicationId) {
      throw new InvalidTransitionError('cross-application compare', 'same application only');
    }
    return summarizeDiff(
      {
        id: from.id,
        version: from.version,
        commitSha: from.commitSha,
        status: from.status,
        trigger: from.trigger,
        approvedById: from.approvedById ?? null,
        startedAt: from.startedAt,
        finishedAt: from.completedAt,
        createdAt: from.createdAt,
        environmentId: from.environmentId,
        environmentType: from.environment.type,
        violations: Array.isArray(from.policyViolations)
          ? (from.policyViolations as unknown[])
          : undefined,
      },
      {
        id: to.id,
        version: to.version,
        commitSha: to.commitSha,
        status: to.status,
        trigger: to.trigger,
        approvedById: to.approvedById ?? null,
        startedAt: to.startedAt,
        finishedAt: to.completedAt,
        createdAt: to.createdAt,
        environmentId: to.environmentId,
        environmentType: to.environment.type,
        violations: Array.isArray(to.policyViolations)
          ? (to.policyViolations as unknown[])
          : undefined,
      },
    );
  },
};
