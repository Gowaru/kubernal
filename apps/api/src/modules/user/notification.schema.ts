import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'deploy_success',
  'deploy_failure',
  'approval_pending',
  'policy_violation',
] as const;

export const updateNotificationPrefsSchema = z.object({
  preferences: z.array(
    z.object({
      type: z.enum(NOTIFICATION_TYPES),
      enabled: z.boolean(),
    }),
  ),
});
