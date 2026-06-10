import type { GoldenPathTemplate } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { templateRepository } from './template.repository.js';

export const templateService = {
  async list(): Promise<GoldenPathTemplate[]> {
    return templateRepository.findAll();
  },

  async getById(id: string): Promise<GoldenPathTemplate> {
    const template = await templateRepository.findById(id);
    if (!template) throw new NotFoundError('Template', id);
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
  }): Promise<GoldenPathTemplate> {
    return templateRepository.create(data);
  },

  async update(
    id: string,
    data: {
      name?: string;
      version?: string;
      description?: string;
      repository?: string;
      parameters?: Record<string, unknown>;
      steps?: Record<string, unknown>[];
    },
  ): Promise<GoldenPathTemplate> {
    await this.getById(id);
    return templateRepository.update(id, data);
  },

  async delete(id: string): Promise<GoldenPathTemplate> {
    await this.getById(id);
    return templateRepository.delete(id);
  },
};
