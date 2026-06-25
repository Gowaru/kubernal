import { z } from 'zod';
import { REPO_URL_REGEX } from '../../shared/repo-utils.js';

const APP_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;

export const createApplicationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(52, 'Maximum 52 characters')
    .regex(APP_NAME_REGEX, 'Letters, numbers and hyphens only (no spaces or special characters)'),
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
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateApplicationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(52, 'Maximum 52 characters')
    .regex(APP_NAME_REGEX, 'Letters, numbers and hyphens only (no spaces or special characters)')
    .optional(),
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
