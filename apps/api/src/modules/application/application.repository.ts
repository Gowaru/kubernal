import type { Prisma } from '@prisma/client';
import { db } from '../../shared/database.js';
import {
  publicApplicationWithRelationsSelect,
  publicApplicationSelect,
} from '../../shared/serializers.js';

export interface AppListQuery {
  search?: string;
  teamId?: string;
  status?: string;
  templateId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Sanitized projection – `webhookSecret` and the owner's `passwordHash` are never fetched. */
const LIST_SELECT = {
  ...publicApplicationWithRelationsSelect,
  environments: true,
} as const satisfies Prisma.ApplicationSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  deployments: true,
} as const satisfies Prisma.ApplicationSelect;

/** Sanitized projection reused after every write (create/update/delete). */
export const CREATE_SELECT = {
  ...publicApplicationWithRelationsSelect,
  environments: true,
} as const satisfies Prisma.ApplicationSelect;

/** Team listing only needs the scalars + environments, not the full relations. */
const TEAM_SELECT = {
  ...publicApplicationSelect,
  environments: true,
} as const satisfies Prisma.ApplicationSelect;

type AppListRow = Prisma.ApplicationGetPayload<{ select: typeof LIST_SELECT }>;
type AppDetailRow = Prisma.ApplicationGetPayload<{ select: typeof DETAIL_SELECT }>;
type AppRow = Prisma.ApplicationGetPayload<{ select: typeof CREATE_SELECT }>;
type AppTeamRow = Prisma.ApplicationGetPayload<{ select: typeof TEAM_SELECT }>;

function buildWhere(q: AppListQuery): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};
  if (q.teamId) where.teamId = q.teamId;
  if (q.status) where.status = q.status;
  if (q.templateId) where.templateId = q.templateId;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function buildOrderBy(
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): Prisma.ApplicationOrderByWithRelationInput {
  const order = sortOrder ?? 'desc';
  const allowed = new Set(['name', 'createdAt', 'updatedAt', 'status']);
  if (sortBy && allowed.has(sortBy)) {
    return { [sortBy]: order };
  }
  return { createdAt: 'desc' };
}

export const applicationRepository = {
  async findAllPaginated(q: AppListQuery): Promise<{ data: AppListRow[]; total: number }> {
    const where = buildWhere(q);
    const orderBy = buildOrderBy(q.sortBy, q.sortOrder);
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(Math.max(1, q.pageSize ?? 20), 100);
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      db.application.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: LIST_SELECT,
      }),
      db.application.count({ where }),
    ]);
    return { data, total };
  },

  findAll(): Promise<AppListRow[]> {
    return db.application.findMany({ select: LIST_SELECT });
  },

  findById(id: string): Promise<AppDetailRow | null> {
    return db.application.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
  },

  findByTeam(teamId: string): Promise<AppTeamRow[]> {
    return db.application.findMany({
      where: { teamId },
      select: TEAM_SELECT,
    });
  },

  create(data: {
    name: string;
    description?: string;
    templateId: string;
    teamId: string;
    ownerId: string;
    repositoryUrl?: string;
    status?: string;
  }): Promise<AppRow> {
    return db.application.create({
      data,
      select: CREATE_SELECT,
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      repositoryUrl?: string | null;
      status?: string;
      archivedAt?: Date | null;
    },
  ): Promise<AppRow> {
    return db.application.update({ where: { id }, data, select: CREATE_SELECT });
  },

  delete(id: string): Promise<AppRow> {
    return db.application.delete({ where: { id }, select: CREATE_SELECT });
  },
};
