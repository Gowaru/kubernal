import type { Application } from '@prisma/client';
import { db } from '../../shared/database.js';

export const applicationRepository = {
  findAll(): Promise<Application[]> {
    return db.application.findMany({
      include: { team: true, template: true, owner: true, environments: true },
    });
  },

  findById(id: string): Promise<Application | null> {
    return db.application.findUnique({
      where: { id },
      include: { team: true, template: true, owner: true, environments: true, deployments: true },
    });
  },

  findByTeam(teamId: string): Promise<Application[]> {
    return db.application.findMany({ where: { teamId }, include: { environments: true } });
  },

  create(data: {
    name: string;
    description?: string;
    templateId: string;
    teamId: string;
    ownerId: string;
    repositoryUrl?: string;
    status?: string;
  }): Promise<Application> {
    return db.application.create({
      data,
      include: { team: true, template: true, owner: true },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      repositoryUrl?: string | null;
      status?: string;
    },
  ): Promise<Application> {
    return db.application.update({ where: { id }, data });
  },

  delete(id: string): Promise<Application> {
    return db.application.delete({ where: { id } });
  },
};
