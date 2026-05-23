import { db } from '../../shared/database.js';

export const applicationRepository = {
  findAll() {
    return db.application.findMany({
      include: { team: true, template: true, owner: true, environments: true },
    });
  },

  findById(id: string) {
    return db.application.findUnique({
      where: { id },
      include: { team: true, template: true, owner: true, environments: true, deployments: true },
    });
  },

  findByTeam(teamId: string) {
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
  }) {
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
  ) {
    return db.application.update({ where: { id }, data });
  },

  delete(id: string) {
    return db.application.delete({ where: { id } });
  },
};
