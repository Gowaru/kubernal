import type { Pipeline } from '@prisma/client';
import { db } from '../../shared/database.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { pipelineRepository } from './pipeline.repository.js';

export const pipelineService = {
  async list(): Promise<Pipeline[]> {
    return pipelineRepository.findAll();
  },

  async getById(id: string): Promise<Pipeline> {
    const pipeline = await pipelineRepository.findById(id);
    if (!pipeline) throw new NotFoundError('Pipeline', id);
    return pipeline;
  },

  async create(data: { deploymentId: string; name: string; logsUrl?: string }): Promise<Pipeline> {
    const activePipeline = await db.pipeline.findFirst({
      where: {
        deploymentId: data.deploymentId,
        status: { in: ['pending', 'running'] },
      },
    });
    if (activePipeline) {
      throw new ConflictError(
        `A pipeline is already active for this deployment (${activePipeline.id})`,
      );
    }
    return pipelineRepository.create({ ...data, status: 'running' });
  },

  async getWithSteps(id: string): Promise<Pipeline> {
    const pipeline = await pipelineRepository.findWithSteps(id);
    if (!pipeline) throw new NotFoundError('Pipeline', id);
    return pipeline;
  },

  async updateStatus(id: string, status: string): Promise<Pipeline> {
    await this.getById(id);
    const completedAt = ['success', 'failed', 'cancelled'].includes(status)
      ? new Date()
      : undefined;
    return pipelineRepository.updateStatus(id, status, completedAt);
  },
};
