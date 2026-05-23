import { InvalidTransitionError, NotFoundError } from '../../shared/errors.js';
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

  async recordViolations(id: string, violations: Record<string, unknown>[]) {
    const deployment = await deploymentRepository.findById(id);
    if (!deployment) throw new NotFoundError('Deployment', id);
    return deploymentRepository.savePolicyViolations(id, violations);
  },
};
