import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { userRepository } from './user.repository.js';

export const userService = {
  async list() {
    return userRepository.findAll();
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  },

  async create(data: { email: string; name: string; role?: string; teamId?: string }) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError(`User with email '${data.email}' already exists`);
    return userRepository.create(data);
  },

  async update(id: string, data: { name?: string; role?: string; teamId?: string | null }) {
    await this.getById(id);
    return userRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id);
    return userRepository.delete(id);
  },
};
