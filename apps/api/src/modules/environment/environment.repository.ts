import type { Environment } from '@prisma/client';
import { db } from '../../shared/database.js';

export const environmentRepository = {
  findAll(): Promise<Environment[]> {
    return db.environment.findMany({ include: { application: true } });
  },

  findById(id: string): Promise<Environment | null> {
    return db.environment.findUnique({ where: { id }, include: { application: true } });
  },

  findByApplication(applicationId: string): Promise<Environment[]> {
    return db.environment.findMany({ where: { applicationId } });
  },

  create(data: {
    name: string;
    type: string;
    applicationId: string;
    namespace: string;
    clusterName?: string;
    requiresApproval?: boolean;
  }): Promise<Environment> {
    return db.environment.create({ data, include: { application: true } });
  },

  update(id: string, data: { name?: string; namespace?: string; requiresApproval?: boolean }): Promise<Environment> {
    return db.environment.update({ where: { id }, data });
  },

  delete(id: string): Promise<Environment> {
    return db.environment.delete({ where: { id } });
  },
};
