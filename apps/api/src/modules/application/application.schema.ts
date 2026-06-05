import { z } from 'zod';
import { REPO_URL_REGEX } from '../../shared/repo-utils.js';

export const createApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  templateId: z.string().uuid(),
  teamId: z.string().uuid(),
  ownerId: z.string().uuid(),
  repositoryUrl: z
    .string()
    .trim()
    .regex(
      REPO_URL_REGEX,
      'Doit être une URL GitHub, GitLab ou Bitbucket (.git)',
    )
    .optional(),
});

export const updateApplicationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  repositoryUrl: z
    .string()
    .trim()
    .regex(
      REPO_URL_REGEX,
      'Doit être une URL GitHub, GitLab ou Bitbucket (.git)',
    )
    .nullable()
    .optional(),
  status: z.enum(['creating', 'active', 'failed', 'archived']).optional(),
});
