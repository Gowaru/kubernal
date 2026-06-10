import type { Request, Response } from 'express';
import { policyService } from './policy.service.js';

export const policyController = {
  async list(_req: Request, res: Response): Promise<void> {
    const policies = await policyService.list();
    res.json({ data: policies, total: policies.length });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const policy = await policyService.getById(id);
    res.json({ data: policy });
  },

  async create(req: Request, res: Response): Promise<void> {
    const policy = await policyService.create(req.body);
    res.status(201).json({ data: policy });
  },

  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const policy = await policyService.update(id, req.body);
    res.json({ data: policy });
  },

  async delete(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await policyService.delete(id);
    res.status(204).send();
  },
};
