import type { Request, Response } from 'express';
import { webhookOutboundService } from './webhook-outbound.service.js';

export const webhookOutboundController = {
  async listConfigs(req: Request, res: Response) {
    const applicationId = req.params['applicationId'] as string;
    const configs = await webhookOutboundService.listConfigs(applicationId);
    res.json({ data: configs });
  },

  async getConfig(req: Request, res: Response) {
    const id = req.params['id'] as string;
    const config = await webhookOutboundService.getConfig(id);
    res.json({ data: config });
  },

  async createConfig(req: Request, res: Response) {
    const config = await webhookOutboundService.createConfig(req.body);
    res.status(201).json({ data: config });
  },

  async updateConfig(req: Request, res: Response) {
    const id = req.params['id'] as string;
    const config = await webhookOutboundService.updateConfig(id, req.body);
    res.json({ data: config });
  },

  async deleteConfig(req: Request, res: Response) {
    const id = req.params['id'] as string;
    await webhookOutboundService.deleteConfig(id);
    res.status(204).end();
  },

  async testConfig(req: Request, res: Response) {
    const id = req.params['id'] as string;
    await webhookOutboundService.testConfig(id);
    res.json({ message: 'Webhook de test envoyé' });
  },

  async listDeliveries(req: Request, res: Response) {
    const configId = req.params['configId'] as string;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const deliveries = await webhookOutboundService.listDeliveries(configId, limit);
    res.json({ data: deliveries });
  },
};
