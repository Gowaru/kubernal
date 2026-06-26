import type { User } from '@prisma/client';
import { db } from '../../shared/database.js';

export const userRepository = {
  findAll(): Promise<User[]> {
    return db.user.findMany({ include: { team: true } });
  },

  findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id }, include: { team: true } });
  },

  findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  },

  create(data: { email: string; name: string; role?: string; teamId?: string }): Promise<User> {
    return db.user.create({ data, include: { team: true } });
  },

  update(id: string, data: { name?: string; role?: string; teamId?: string | null }): Promise<User> {
    return db.user.update({ where: { id }, data, include: { team: true } });
  },

  delete(id: string): Promise<User> {
    return db.user.delete({ where: { id } });
  },

  count(): Promise<number> {
    return db.user.count();
  },
};
