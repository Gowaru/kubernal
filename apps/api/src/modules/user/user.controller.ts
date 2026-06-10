import type { Request, Response } from 'express';
import { userService } from './user.service.js';

export const userController = {
  async list(_req: Request, res: Response): Promise<void> {
    const users = await userService.list();
    res.json({ data: users, total: users.length });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const user = await userService.getById(id);
    res.json({ data: user });
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = await userService.create(req.body);
    res.status(201).json({ data: user });
  },

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const user = await userService.update(id, req.body);
    res.json({ data: user });
  },

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await userService.delete(id);
    res.status(204).send();
  },
};
