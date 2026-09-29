import type { Prisma, Deployment } from '@prisma/client';
import { db } from '../../shared/database.js';
import { toJsonArray } from '../../shared/json.js';
import { publicApplicationSelect, publicUserSelect } from '../../shared/serializers.js';

/** Sanitized `approvedBy` projection: no `passwordHash`, no `oidcId`. */
const APPROVER_SELECT = { select: publicUserSelect } as const;

/** Sanitized embedded `application`: no `webhookSecret`. */
const APPLICATION_RELATION = { select: publicApplicationSelect } as const;

const LIST_INCLUDE = {
  application: APPLICATION_RELATION,
  environment: true,
  approvedBy: APPROVER_SELECT,
  pipelines: true,
} as const satisfies Prisma.DeploymentInclude;

const APP_INCLUDE = {
  environment: true,
  approvedBy: APPROVER_SELECT,
} as const satisfies Prisma.DeploymentInclude;

const CREATE_INCLUDE = {
  application: APPLICATION_RELATION,
  environment: true,
  pipelines: true,
} as const satisfies Prisma.DeploymentInclude;

/** Row shapes: sanitized projections, i.e. no credential can reach a response. */
export type DeploymentListRow = Prisma.DeploymentGetPayload<{ include: typeof LIST_INCLUDE }>;
export type DeploymentAppRow = Prisma.DeploymentGetPayload<{ include: typeof APP_INCLUDE }>;
export type DeploymentCreateRow = Prisma.DeploymentGetPayload<{ include: typeof CREATE_INCLUDE }>;

export const deploymentRepository = {
  findAll(): Promise<DeploymentListRow[]> {
    return db.deployment.findMany({ include: LIST_INCLUDE, orderBy: { createdAt: 'desc' } });
  },

  findById(id: string): Promise<DeploymentListRow | null> {
    return db.deployment.findUnique({ where: { id }, include: LIST_INCLUDE });
  },

  findByApplication(applicationId: string): Promise<DeploymentAppRow[]> {
    return db.deployment.findMany({
      where: { applicationId },
      include: APP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  },

  findByEnvironment(environmentId: string): Promise<Deployment[]> {
    return db.deployment.findMany({
      where: { environmentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findLatestByApplication(applicationId: string): Promise<{ version: string } | null> {
    return db.deployment.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
  },

  create(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
    trigger?: string;
    status?: string;
  }): Promise<DeploymentCreateRow> {
    return db.deployment.create({ data, include: CREATE_INCLUDE });
  },

  updateStatus(id: string, status: string, completedAt?: Date): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { status, ...(completedAt ? { completedAt } : {}) },
    });
  },

  approve(id: string, approvedById: string): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { approvedById, status: 'deploying' },
    });
  },

  savePolicyViolations(id: string, violations: Record<string, unknown>[]): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { policyViolations: toJsonArray(violations) },
    });
  },

  delete(id: string): Promise<Deployment> {
    return db.deployment.delete({ where: { id } });
  },
};
