import { z } from 'zod';

export const createPipelineSchema = z.object({
  deploymentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  logsUrl: z.string().url().optional(),
});

export const updatePipelineStatusSchema = z.object({
  status: z.enum(['running', 'success', 'failed', 'cancelled']),
});
