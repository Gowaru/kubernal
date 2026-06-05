import { z } from 'zod';

export const listPodsSchema = z.object({
  namespace: z.string().optional().default('default'),
  cluster: z.string().optional().default('kubernal-prod'),
  labelSelector: z.string().optional(),
});

export const listServicesSchema = z.object({
  namespace: z.string().optional().default('default'),
  cluster: z.string().optional().default('kubernal-prod'),
});

export const listEventsSchema = z.object({
  namespace: z.string().optional().default('default'),
  cluster: z.string().optional().default('kubernal-prod'),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
});

export const getArgoStatusSchema = z.object({
  application: z.string().min(1),
});

export const listHPASchema = z.object({
  namespace: z.string().optional().default('default'),
});

export const listClaimsSchema = z.object({
  namespace: z.string().optional().default('default'),
});
