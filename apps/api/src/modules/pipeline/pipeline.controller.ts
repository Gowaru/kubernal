import type { Request, Response } from "express";
import { pipelineService } from "./pipeline.service.js";

export const pipelineController = {
  async list(_req: Request, res: Response) {
    const pipelines = await pipelineService.list();
    res.json({ data: pipelines, total: pipelines.length });
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const pipeline = await pipelineService.getById(id);
    res.json({ data: pipeline });
  },

  async create(req: Request, res: Response) {
    const pipeline = await pipelineService.create(req.body);
    res.status(201).json({ data: pipeline });
  },

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body;
    const id = req.params.id as string;
    const pipeline = await pipelineService.updateStatus(id, status);
    res.json({ data: pipeline });
  },
};
