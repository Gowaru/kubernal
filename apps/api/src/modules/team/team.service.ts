import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { teamRepository } from './team.repository.js';

export const teamService = {
  async list() {
    return teamRepository.findAll();
  },

  async getById(id: string) {
    const team = await teamRepository.findById(id);
    if (!team) throw new NotFoundError('Team', id);
    return team;
  },

  async create(data: {
    name: string;
    description?: string;
    quotaCpu?: string;
    quotaMemory?: string;
    namespacePrefix: string;
  }) {
    const existing = await teamRepository.findByName(data.name);
    if (existing) throw new ConflictError(`Team '${data.name}' already exists`);
    return teamRepository.create(data);
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null; quotaCpu?: string; quotaMemory?: string },
  ) {
    await this.getById(id);
    return teamRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return teamRepository.delete(id);
  },
};
