import { z } from 'zod';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

function isStrictSemver(value: string): boolean {
  return SEMVER_RE.test(value);
}

export const createDeploymentSchema = z.object({
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  version: z.string().min(1),
  commitSha: z.string().min(1),
  trigger: z.enum(['manual', 'git_push', 'scheduled', 'rollback']).optional().default('manual'),
});

export const createDeploymentStrictSchema = z.object({
  applicationId: z.string().uuid(),
  environmentId: z.string().uuid(),
  version: z.string().min(1).refine(isStrictSemver, {
    message: 'version must be valid semver (e.g., 1.2.3, 1.2.3+sha.abc, 1.2.3-alpha.1)',
  }),
  commitSha: z.string().min(1),
  trigger: z.enum(['manual', 'git_push', 'scheduled', 'rollback']).optional().default('manual'),
});

export const bumpVersionSchema = z.object({
  bump: z.enum(['auto', 'major', 'minor', 'patch']).default('auto'),
  currentVersion: z
    .string()
    .min(1)
    .refine(isStrictSemver, {
      message: 'currentVersion must be valid semver',
    })
    .optional(),
  commitSha: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
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

export type BumpType = z.infer<typeof bumpVersionSchema>['bump'];
