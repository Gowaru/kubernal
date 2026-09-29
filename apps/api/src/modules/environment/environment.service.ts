import type { Environment } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { environmentRepository } from './environment.repository.js';

/** Sanitized row shape returned by the repository. */
type EnvironmentRow = NonNullable<Awaited<ReturnType<typeof environmentRepository.findById>>>;

export const environmentService = {
  async list(): Promise<EnvironmentRow[]> {
    return environmentRepository.findAll();
  },

  async getById(id: string): Promise<EnvironmentRow> {
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
  }): Promise<NonNullable<EnvironmentRow>> {
    return environmentRepository.create(data);
  },

  async update(
    id: string,
    data: { name?: string; namespace?: string; requiresApproval?: boolean },
  ): Promise<NonNullable<EnvironmentRow>> {
    await this.getById(id);
    return environmentRepository.update(id, data);
  },

  async delete(id: string): Promise<Environment> {
    await this.getById(id);
    return environmentRepository.delete(id);
  },
};
