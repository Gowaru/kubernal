import { NotFoundError } from '../../shared/errors.js';
import { applicationRepository } from './application.repository.js';

export const applicationService = {
  async list() {
    return applicationRepository.findAll();
  },

  async getById(id: string) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return app;
  },

  async create(data: {
    name: string;
    description?: string;
    templateId: string;
    teamId: string;
    ownerId: string;
    repositoryUrl?: string;
  }) {
    return applicationRepository.create({ ...data, status: 'creating' });
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      repositoryUrl?: string | null;
      status?: string;
    },
  ) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.update(id, data);
  },

  async delete(id: string) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.delete(id);
  },
};
