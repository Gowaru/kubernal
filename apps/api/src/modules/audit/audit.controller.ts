import type { Request, Response } from 'express';
import { auditService } from './audit.service.js';

export const auditController = {
  async list(req: Request, res: Response): Promise<void> {
    const { resource, resourceId, action, actorId, page, pageSize } = req.query;
    const limit = Math.min(Number(pageSize) || 50, 200);
    const offset = ((Number(page) || 1) - 1) * limit;

    const result = await auditService.list({
      resource: resource as string | undefined,
      resourceId: resourceId as string | undefined,
      action: action as string | undefined,
      actorId: actorId as string | undefined,
      limit,
      offset,
    });

    res.json({
      data: result.data,
      total: result.total,
      page: Number(page) || 1,
      pageSize: limit,
    });
  },
};
