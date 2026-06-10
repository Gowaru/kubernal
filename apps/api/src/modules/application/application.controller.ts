import type { Request, Response } from 'express';
import { applicationService } from './application.service.js';

export const applicationController = {
  async list(_req: Request, res: Response): Promise<void> {
    const apps = await applicationService.list();
    res.json({ data: apps, total: apps.length });
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
};
