import type { Request, Response } from 'express';
import { teamService } from './team.service.js';

export const teamController = {
  async list(_req: Request, res: Response) {
    const teams = await teamService.list();
    res.json({ data: teams, total: teams.length });
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const team = await teamService.getById(id);
    res.json({ data: team });
  },

  async create(req: Request, res: Response) {
    const team = await teamService.create(req.body);
    res.status(201).json({ data: team });
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const team = await teamService.update(id, req.body);
    res.json({ data: team });
  },

  async delete(req: Request, res: Response) {
    const id = req.params.id as string;
    await teamService.delete(id);
    res.status(204).send();
  },
};
