import { z } from 'zod';

export const createDeploymentSchema = z.object({
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  version: z.string().min(1),
  commitSha: z.string().min(1),
  trigger: z.enum(['manual', 'git_push', 'scheduled', 'rollback']).optional().default('manual'),
});

export const transitionStatusSchema = z.object({
  status: z.enum(['building', 'deploying', 'healthy', 'failed', 'rolled_back', 'cancelled']),
});

export const approveDeploymentSchema = z.object({
  approvedById: z.string().uuid(),
});

export const recordViolationsSchema = z.object({
  violations: z.array(
    z.object({
      policyId: z.string(),
      policyName: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      message: z.string(),
      resource: z.string(),
      details: z.record(z.unknown()).optional(),
    }),
  ),
});

export const promoteDeploymentSchema = z.object({
  targetEnv: z.enum(['staging', 'prod']),
});
