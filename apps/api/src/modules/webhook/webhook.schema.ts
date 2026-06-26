import { z } from 'zod';

export const webhookProviderSchema = z.enum(['github', 'gitlab', 'bitbucket']);

export const webhookIngestParamsSchema = z.object({
  appId: z.string().uuid(),
  provider: webhookProviderSchema,
});

export const webhookAppIdParamsSchema = z.object({
  appId: z.string().uuid(),
});
