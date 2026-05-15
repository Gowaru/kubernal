import type { Request, Response } from "express";
import { environmentService } from "./environment.service.js";

export const environmentController = {
  async list(_req: Request, res: Response) {
    const envs = await environmentService.list();
    res.json({ data: envs, total: envs.length });
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const env = await environmentService.getById(id);
    res.json({ data: env });
  },

  async create(req: Request, res: Response) {
    const env = await environmentService.create(req.body);
    res.status(201).json({ data: env });
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const env = await environmentService.update(id, req.body);
    res.json({ data: env });
  },

  async delete(req: Request, res: Response) {
    const id = req.params.id as string;
    await environmentService.delete(id);
    res.status(204).send();
  },
};
