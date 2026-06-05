import { InvalidTransitionError, NotFoundError } from '../../shared/errors.js';
import { db } from '../../shared/database.js';
import { deploymentRepository } from './deployment.repository.js';

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
  async list() {
    return deploymentRepository.findAll();
  },

  async getById(id: string) {
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
  }) {
    return deploymentRepository.create(data);
  },

  async transitionStatus(id: string, newStatus: string) {
    const deployment = await deploymentRepository.findById(id);
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

  async approve(id: string, approvedById: string) {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    if (deployment.status !== 'pending') {
      throw new InvalidTransitionError(deployment.status, 'deploying');
    }
    return deploymentRepository.approve(id, approvedById);
  },

  async promote(id: string, targetEnvType: 'staging' | 'prod') {
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

    return deploymentRepository.create({
      applicationId: source.applicationId,
      environmentId: target.id,
      version: source.version,
      commitSha: source.commitSha,
      trigger: 'manual',
      status: target.requiresApproval ? 'pending' : 'building',
    });
  },

  async recordViolations(id: string, violations: Record<string, unknown>[]) {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    return deploymentRepository.savePolicyViolations(id, violations);
  },
};
