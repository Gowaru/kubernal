import type { Team } from '@prisma/client';
import { db } from '../../shared/database.js';

export const teamRepository = {
  findAll(): Promise<Team[]> {
    return db.team.findMany({
      include: { members: true, _count: { select: { applications: true } } },
    });
  },

  findById(id: string): Promise<Team | null> {
    return db.team.findUnique({ where: { id }, include: { members: true, applications: true } });
  },

  findByName(name: string): Promise<Team | null> {
    return db.team.findUnique({ where: { name } });
  },

  create(data: {
    name: string;
    description?: string;
    quotaCpu?: string;
    quotaMemory?: string;
    namespacePrefix: string;
  }): Promise<Team> {
    return db.team.create({ data, include: { members: true } });
  },

  update(
    id: string,
    data: { name?: string; description?: string | null; quotaCpu?: string; quotaMemory?: string },
  ): Promise<Team> {
    return db.team.update({ where: { id }, data });
  },

  delete(id: string): Promise<Team> {
    return db.team.delete({ where: { id } });
  },
};
