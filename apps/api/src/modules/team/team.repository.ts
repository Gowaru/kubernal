import type { Prisma, Team } from '@prisma/client';
import { db } from '../../shared/database.js';
import { publicApplicationSelect, publicUserSelect } from '../../shared/serializers.js';

/** Sanitized `members` projection: no `passwordHash`, no `oidcId`. */
const MEMBERS_RELATION = { select: publicUserSelect } as const;

/** Sanitized `applications` projection: no `webhookSecret`. */
const APPLICATIONS_RELATION = { select: publicApplicationSelect } as const;

const LIST_INCLUDE = {
  members: MEMBERS_RELATION,
  _count: { select: { applications: true } },
} as const satisfies Prisma.TeamInclude;

const DETAIL_INCLUDE = {
  members: MEMBERS_RELATION,
  applications: APPLICATIONS_RELATION,
} as const satisfies Prisma.TeamInclude;

const CREATE_INCLUDE = { members: MEMBERS_RELATION } as const satisfies Prisma.TeamInclude;

/** Row shapes: sanitized projections, i.e. no credential can reach a response. */
export type TeamListRow = Prisma.TeamGetPayload<{ include: typeof LIST_INCLUDE }>;
export type TeamDetailRow = Prisma.TeamGetPayload<{ include: typeof DETAIL_INCLUDE }>;
export type TeamCreateRow = Prisma.TeamGetPayload<{ include: typeof CREATE_INCLUDE }>;

export const teamRepository = {
  findAll(): Promise<TeamListRow[]> {
    return db.team.findMany({ include: LIST_INCLUDE });
  },

  findById(id: string): Promise<TeamDetailRow | null> {
    return db.team.findUnique({ where: { id }, include: DETAIL_INCLUDE });
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
  }): Promise<TeamCreateRow> {
    return db.team.create({ data, include: CREATE_INCLUDE });
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
