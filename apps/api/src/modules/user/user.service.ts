import type { User } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { userRepository } from './user.repository.js';

export const userService = {
  async list(): Promise<User[]> {
    return userRepository.findAll();
  },

  async getById(id: string): Promise<User> {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  },

  async create(data: { email: string; name: string; role?: string; teamId?: string }): Promise<User> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError(`User with email '${data.email}' already exists`);
    return userRepository.create(data);
  },

  async update(id: string, data: { name?: string; role?: string; teamId?: string | null }): Promise<User> {
    await this.getById(id);
    return userRepository.update(id, data);
  },

  async delete(id: string): Promise<User> {
    await this.getById(id);
    return userRepository.delete(id);
  },
};
