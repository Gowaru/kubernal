import type { Request, Response } from 'express';
import { deploymentService } from './deployment.service.js';

export const deploymentController = {
  async list(_req: Request, res: Response) {
    const deployments = await deploymentService.list();
    res.json({ data: deployments, total: deployments.length });
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const deployment = await deploymentService.getById(id);
    res.json({ data: deployment });
  },

  async create(req: Request, res: Response) {
    const deployment = await deploymentService.create(req.body);
    res.status(201).json({ data: deployment });
  },

  async transitionStatus(req: Request, res: Response) {
    const { status } = req.body;
    const id = req.params.id as string;
    const deployment = await deploymentService.transitionStatus(id, status);
    res.json({ data: deployment });
  },

  async approve(req: Request, res: Response) {
    const { approvedById } = req.body;
    const id = req.params.id as string;
    const deployment = await deploymentService.approve(id, approvedById);
    res.json({ data: deployment });
  },

  async recordViolations(req: Request, res: Response) {
    const { violations } = req.body;
    const id = req.params.id as string;
    const deployment = await deploymentService.recordViolations(id, violations);
    res.json({ data: deployment });
  },
};
