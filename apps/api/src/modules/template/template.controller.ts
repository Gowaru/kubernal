import type { Request, Response } from 'express';
import { templateService } from './template.service.js';

export const templateController = {
  async list(_req: Request, res: Response) {
    const templates = await templateService.list();
    res.json({ data: templates, total: templates.length });
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const template = await templateService.getById(id);
    res.json({ data: template });
  },

  async create(req: Request, res: Response) {
    const template = await templateService.create(req.body);
    res.status(201).json({ data: template });
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const template = await templateService.update(id, req.body);
    res.json({ data: template });
  },

  async delete(req: Request, res: Response) {
    const id = req.params.id as string;
    await templateService.delete(id);
    res.status(204).send();
  },
};
