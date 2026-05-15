import { NotFoundError } from "../../shared/errors.js";
import { environmentRepository } from "./environment.repository.js";

export const environmentService = {
  async list() {
    return environmentRepository.findAll();
  },

  async getById(id: string) {
    const env = await environmentRepository.findById(id);
    if (!env) throw new NotFoundError("Environment", id);
    return env;
  },

  async create(data: {
    name: string;
    type: string;
    applicationId: string;
    namespace: string;
    clusterName?: string;
    requiresApproval?: boolean;
  }) {
    return environmentRepository.create(data);
  },

  async update(id: string, data: { name?: string; namespace?: string; requiresApproval?: boolean }) {
    await this.getById(id);
    return environmentRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return environmentRepository.delete(id);
  },
};
