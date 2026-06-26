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

export const getPodLogsParamsSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

export const getPodLogsQuerySchema = z.object({
  tailLines: z.coerce.number().int().min(1).max(10000).optional().default(100),
  container: z.string().optional(),
  cluster: z.string().optional().default('kubernal-prod'),
});

export const scaleDeploymentParamsSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

export const scaleDeploymentSchema = z.object({
  replicas: z.number().int().min(0).max(100),
});

export const restartDeploymentParamsSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

export const restartDeploymentSchema = z.object({}).optional();

export const deleteDeploymentParamsSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

export const deleteDeploymentQuerySchema = z.object({
  deleteService: z.coerce.boolean().optional().default(true),
});

export const execInPodParamsSchema = z.object({
  namespace: z.string().min(1),
  name: z.string().min(1),
});

export const execInPodSchema = z.object({
  command: z.array(z.string()).optional().default(['/bin/sh']),
  container: z.string().optional(),
});

export const deploymentAccessParamsSchema = z.object({
  id: z.string().uuid(),
});

export const deploymentAccessQuerySchema = z.object({
  cluster: z.string().optional().default('kubernal-prod'),
});

export const syncArgoSchema = z.object({
  application: z.string().min(1),
});

export const setAutoSyncSchema = z.object({
  application: z.string().min(1),
  enabled: z.boolean(),
});

export const compareDeploymentsQuerySchema = z.object({
  from: z.string().uuid(),
  to: z.string().uuid(),
});
