import type { Application, Prisma } from '@prisma/client';
import { db } from '../../shared/database.js';

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

const LIST_INCLUDE = { team: true, template: true, owner: true, environments: true } as const;

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
  async findAllPaginated(q: AppListQuery): Promise<{ data: Application[]; total: number }> {
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
        include: LIST_INCLUDE,
      }),
      db.application.count({ where }),
    ]);
    return { data, total };
  },

  findAll(): Promise<Application[]> {
    return db.application.findMany({ include: LIST_INCLUDE });
  },

  findById(id: string): Promise<Application | null> {
    return db.application.findUnique({
      where: { id },
      include: { ...LIST_INCLUDE, deployments: true },
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
      archivedAt?: Date | null;
    },
  ): Promise<Application> {
    return db.application.update({ where: { id }, data });
  },

  delete(id: string): Promise<Application> {
    return db.application.delete({ where: { id } });
  },
};
