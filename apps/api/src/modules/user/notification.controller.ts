import type { Request, Response } from 'express';
import * as notificationService from './notification.service.js';
import { updateNotificationPrefsSchema } from './notification.schema.js';

export const notificationController = {
  async getMyPrefs(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const prefs = await notificationService.getNotificationPrefs(userId);
    res.json({ data: prefs });
  },

  async updateMyPrefs(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const body = updateNotificationPrefsSchema.parse(req.body);
    const prefs = await notificationService.upsertNotificationPrefs(userId, body.preferences);
    res.json({ data: prefs });
  },
};
