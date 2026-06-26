import type { SecurityPolicy } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { policyRepository } from './policy.repository.js';

export const policyService = {
  async list(): Promise<SecurityPolicy[]> {
    return policyRepository.findAll();
  },

  async getById(id: string): Promise<SecurityPolicy> {
    const policy = await policyRepository.findById(id);
    if (!policy) throw new NotFoundError('SecurityPolicy', id);
    return policy;
  },

  async create(data: {
    name: string;
    description: string;
    category: string;
    severity: string;
    engine: string;
    rules?: Record<string, unknown>;
    enabled?: boolean;
  }): Promise<SecurityPolicy> {
    return policyRepository.create(data);
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: string;
      severity?: string;
      rules?: Record<string, unknown>;
      enabled?: boolean;
    },
  ): Promise<SecurityPolicy> {
    await this.getById(id);
    return policyRepository.update(id, data);
  },

  async delete(id: string): Promise<SecurityPolicy> {
    await this.getById(id);
    return policyRepository.delete(id);
  },
};
