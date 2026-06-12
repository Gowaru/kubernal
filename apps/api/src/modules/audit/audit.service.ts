import { db } from '../../shared/database.js';
import type { Prisma } from '@prisma/client';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION' | 'LOGIN' | 'APPROVE' | 'PROMOTE' | 'TEST' | 'REGENERATE';

interface AuditLogInput {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const auditService = {
  async log(input: AuditLogInput): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        details: input.details as Prisma.InputJsonValue ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  },

  async list(opts: { resource?: string; resourceId?: string; action?: string; actorId?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = {};
    if (opts.resource) where['resource'] = opts.resource;
    if (opts.resourceId) where['resourceId'] = opts.resourceId;
    if (opts.action) where['action'] = opts.action;
    if (opts.actorId) where['actorId'] = opts.actorId;

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      db.auditLog.count({ where }),
    ]);
    return { data, total };
  },
};
