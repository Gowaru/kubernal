import type { Request, Response } from 'express';
import { apiKeyService } from './api-key.service.js';

export const apiKeyController = {
  async create(req: Request, res: Response): Promise<void> {
    const { name, expiresInDays } = req.body as { name: string; expiresInDays?: number };
    const userId = req.user!.id;
    const key = await apiKeyService.createKey(userId, name, expiresInDays);
    res.status(201).json({ data: key });
  },

  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const keys = await apiKeyService.listKeys(userId);
    res.json({ data: keys, total: keys.length });
  },

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const keyId = req.params.id as string;
    await apiKeyService.deleteKey(userId, keyId);
    res.status(204).send();
  },
};
