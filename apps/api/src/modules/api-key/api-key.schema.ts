import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
