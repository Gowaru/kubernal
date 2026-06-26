import { z } from 'zod';

export const createPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.enum(['security', 'compliance', 'cost', 'operations']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  engine: z.enum(['kyverno', 'opa', 'custom']),
  rules: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional().default(true),
});

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['security', 'compliance', 'cost', 'operations']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  rules: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});
