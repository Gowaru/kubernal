import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z
    .enum(['viewer', 'developer', 'platform_engineer', 'admin', 'security_admin'])
    .optional()
    .default('developer'),
  teamId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['viewer', 'developer', 'platform_engineer', 'admin', 'security_admin']).optional(),
  teamId: z.string().uuid().nullable().optional(),
});
