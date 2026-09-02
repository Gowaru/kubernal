import { z } from 'zod';

export const createWebhookConfigSchema = z.object({
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  url: z.string().url(),
  secret: z.string().min(1).max(500).optional(),
  events: z
    .array(z.enum(['started', 'success', 'failure', 'rolled_back', 'cancelled', 'approval_needed']))
    .optional(),
});

export const updateWebhookConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().min(1).max(500).nullable().optional(),
  events: z
    .array(z.enum(['started', 'success', 'failure', 'rolled_back', 'cancelled', 'approval_needed']))
    .optional(),
  enabled: z.boolean().optional(),
});
