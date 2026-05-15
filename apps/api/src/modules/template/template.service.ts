import { NotFoundError } from "../../shared/errors.js";
import { templateRepository } from "./template.repository.js";

export const templateService = {
  async list() {
    return templateRepository.findAll();
  },

  async getById(id: string) {
    const template = await templateRepository.findById(id);
    if (!template) throw new NotFoundError("Template", id);
    return template;
  },

  async create(data: {
    name: string;
    category: string;
    description: string;
    repository: string;
    version?: string;
    parameters?: Record<string, unknown>;
    steps?: Record<string, unknown>[];
  }) {
    return templateRepository.create(data);
  },

  async update(id: string, data: { name?: string; version?: string; description?: string; repository?: string; parameters?: Record<string, unknown>; steps?: Record<string, unknown>[] }) {
    await this.getById(id);
    return templateRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return templateRepository.delete(id);
  },
};
