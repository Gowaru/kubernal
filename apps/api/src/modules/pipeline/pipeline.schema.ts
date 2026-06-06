import { z } from 'zod';

export const createPipelineSchema = z.object({
  deploymentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  logsUrl: z.string().url().optional(),
});

export const updatePipelineStatusSchema = z.object({
  status: z.enum(['running', 'success', 'failed', 'cancelled']),
});

export const createPipelineFromTemplateSchema = z.object({
  deploymentId: z.string().uuid(),
  templateId: z.string().uuid(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const pipelineStepParamSchema = z.object({
  action: z.string().min(1),
  name: z.string().min(1).optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const executePipelineTemplateSchema = z.object({
  templateId: z.string().uuid(),
  params: z.array(pipelineStepParamSchema),
});
