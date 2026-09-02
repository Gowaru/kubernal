import type { Request, Response } from 'express';
import { applicationService } from './application.service.js';

export const applicationController = {
  async list(req: Request, res: Response): Promise<void> {
    const { search, teamId, status, templateId, page, pageSize, sortBy, sortOrder } = req.query;
    const result = await applicationService.list({
      search: search as string | undefined,
      teamId: teamId as string | undefined,
      status: status as string | undefined,
      templateId: templateId as string | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });
    res.json({ data: result.data, total: result.total });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const app = await applicationService.getById(id);
    res.json({ data: app });
  },

  async create(req: Request, res: Response): Promise<void> {
    const app = await applicationService.create(req.body);
    res.status(201).json({ data: app });
  },

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const app = await applicationService.update(id, req.body);
    res.json({ data: app });
  },

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await applicationService.delete(id);
    res.status(204).send();
  },

  async archive(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const app = await applicationService.archive(id);
    res.json({ data: app });
  },

  async unarchive(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const app = await applicationService.unarchive(id);
    res.json({ data: app });
  },
};
