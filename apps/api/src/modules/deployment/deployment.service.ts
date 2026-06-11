import { InvalidTransitionError, NotFoundError } from '../../shared/errors.js';
import { db } from '../../shared/database.js';
import { deploymentRepository } from './deployment.repository.js';
import { summarizeDiff, type DeploymentDiff } from '../../shared/git-diff.js';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async list(): Promise<any[]> {
    return deploymentRepository.findAll();
  },

  async getLatestVersion(applicationId?: string): Promise<string | null> {
    if (!applicationId) return null;
    const latest = await deploymentRepository.findLatestByApplication(applicationId);
    return latest?.version ?? null;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getById(id: string): Promise<any> {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any> {
    return deploymentRepository.create(data);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async transitionStatus(id: string, newStatus: string): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployment: any = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);

    const current = deployment.status;
    if (!canTransition(current, newStatus)) {
      throw new InvalidTransitionError(current, newStatus);
    }

    const completedAt = ['healthy', 'failed', 'rolled_back', 'cancelled'].includes(newStatus)
      ? new Date()
      : undefined;

    return deploymentRepository.updateStatus(id, newStatus, completedAt);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async approve(id: string, approvedById: string): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployment: any = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    if (deployment.status !== 'pending') {
      throw new InvalidTransitionError(deployment.status, 'deploying');
    }
    return deploymentRepository.approve(id, approvedById);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async promote(id: string, targetEnvType: 'staging' | 'prod'): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source: any = await deploymentRepository.findById(id);
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

    return deploymentRepository.create({
      applicationId: source.applicationId,
      environmentId: target.id,
      version: source.version,
      commitSha: source.commitSha,
      trigger: 'manual',
      status: target.requiresApproval ? 'pending' : 'building',
    });
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async recordViolations(id: string, violations: Record<string, unknown>[]): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deployment: any = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    return deploymentRepository.savePolicyViolations(id, violations);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getVulnerabilities(id: string): Promise<any[]> {
    return db.deploymentVulnerability.findMany({
      where: { deploymentId: id },
      orderBy: { detectedAt: 'desc' },
    });
  },

  async compare(fromId: string, toId: string): Promise<DeploymentDiff> {
    const [from, to] = await Promise.all([
      this.getById(fromId),
      this.getById(toId),
    ]);
    if (from.applicationId !== to.applicationId) {
      throw new InvalidTransitionError(
        'cross-application compare',
        'same application only',
      );
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
        violations: Array.isArray(from.policyViolations) ? from.policyViolations : undefined,
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
        violations: Array.isArray(to.policyViolations) ? to.policyViolations : undefined,
      },
    );
  },
};
