import { NotFoundError } from "../../shared/errors.js";
import { policyRepository } from "./policy.repository.js";

export const policyService = {
  async list() {
    return policyRepository.findAll();
  },

  async getById(id: string) {
    const policy = await policyRepository.findById(id);
    if (!policy) throw new NotFoundError("SecurityPolicy", id);
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
  }) {
    return policyRepository.create(data);
  },

  async update(id: string, data: { name?: string; description?: string; category?: string; severity?: string; rules?: Record<string, unknown>; enabled?: boolean }) {
    await this.getById(id);
    return policyRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return policyRepository.delete(id);
  },
};
