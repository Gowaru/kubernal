import type { Environment } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { environmentRepository } from './environment.repository.js';

export const environmentService = {
  async list(): Promise<Environment[]> {
    return environmentRepository.findAll();
  },

  async getById(id: string): Promise<Environment> {
    const env = await environmentRepository.findById(id);
    if (!env) throw new NotFoundError('Environment', id);
    return env;
  },

  async create(data: {
    name: string;
    type: string;
    applicationId: string;
    namespace: string;
    clusterName?: string;
    requiresApproval?: boolean;
  }): Promise<Environment> {
    return environmentRepository.create(data);
  },

  async update(
    id: string,
    data: { name?: string; namespace?: string; requiresApproval?: boolean },
  ): Promise<Environment> {
    await this.getById(id);
    return environmentRepository.update(id, data);
  },

  async delete(id: string): Promise<Environment> {
    await this.getById(id);
    return environmentRepository.delete(id);
  },
};
