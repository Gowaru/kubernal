import type { Prisma, Environment } from '@prisma/client';
import { db } from '../../shared/database.js';
import { publicApplicationSelect } from '../../shared/serializers.js';

/** Sanitized embedded `application`: no `webhookSecret`. */
const APPLICATION_RELATION = { select: publicApplicationSelect } as const;

const WITH_APP_INCLUDE = {
  application: APPLICATION_RELATION,
} as const satisfies Prisma.EnvironmentInclude;

/** Row shape: sanitized projection, i.e. no `webhookSecret` can reach a response. */
export type EnvironmentWithAppRow = Prisma.EnvironmentGetPayload<{
  include: typeof WITH_APP_INCLUDE;
}>;

export const environmentRepository = {
  findAll(): Promise<EnvironmentWithAppRow[]> {
    return db.environment.findMany({ include: WITH_APP_INCLUDE });
  },

  findById(id: string): Promise<EnvironmentWithAppRow | null> {
    return db.environment.findUnique({ where: { id }, include: WITH_APP_INCLUDE });
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
  }): Promise<EnvironmentWithAppRow> {
    return db.environment.create({ data, include: WITH_APP_INCLUDE });
  },

  update(
    id: string,
    data: { name?: string; namespace?: string; requiresApproval?: boolean },
  ): Promise<EnvironmentWithAppRow> {
    return db.environment.update({ where: { id }, data, include: WITH_APP_INCLUDE });
  },

  delete(id: string): Promise<Environment> {
    return db.environment.delete({ where: { id } });
  },
};
