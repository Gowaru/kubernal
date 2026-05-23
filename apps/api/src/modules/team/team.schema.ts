import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  quotaCpu: z.string().optional().default('4'),
  quotaMemory: z.string().optional().default('8Gi'),
  namespacePrefix: z.string().min(1).max(30),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  quotaCpu: z.string().optional(),
  quotaMemory: z.string().optional(),
});
