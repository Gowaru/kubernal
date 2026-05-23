import { NotFoundError } from '../../shared/errors.js';
import { pipelineRepository } from './pipeline.repository.js';

export const pipelineService = {
  async list() {
    return pipelineRepository.findAll();
  },

  async getById(id: string) {
    const pipeline = await pipelineRepository.findById(id);
    if (!pipeline) throw new NotFoundError('Pipeline', id);
    return pipeline;
  },

  async create(data: { deploymentId: string; name: string; logsUrl?: string }) {
    return pipelineRepository.create({ ...data, status: 'running' });
  },

  async updateStatus(id: string, status: string) {
    await this.getById(id);
    const completedAt = ['success', 'failed', 'cancelled'].includes(status)
      ? new Date()
      : undefined;
    return pipelineRepository.updateStatus(id, status, completedAt);
  },
};
