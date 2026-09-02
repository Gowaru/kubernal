import { db } from '../../shared/database.js';
import { logger } from '../../shared/logger.js';
import type { UserNotificationPreference } from '@prisma/client';

export async function getNotificationPrefs(userId: string): Promise<UserNotificationPreference[]> {
  return db.userNotificationPreference.findMany({ where: { userId } });
}

export async function upsertNotificationPrefs(
  userId: string,
  prefs: Array<{ type: string; enabled: boolean }>,
): Promise<UserNotificationPreference[]> {
  const ops = prefs.map((p) =>
    db.userNotificationPreference.upsert({
      where: { userId_type: { userId, type: p.type } },
      create: { userId, type: p.type, enabled: p.enabled },
      update: { enabled: p.enabled },
    }),
  );
  await Promise.all(ops);
  logger.info({ userId, count: prefs.length }, 'Notification preferences updated');
  return getNotificationPrefs(userId);
}
