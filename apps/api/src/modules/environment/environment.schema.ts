import { z } from "zod";

export const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["dev", "staging", "prod"]),
  applicationId: z.string().uuid(),
  namespace: z.string().min(1).max(63),
  clusterName: z.string().optional().default("kubernal"),
  requiresApproval: z.boolean().optional().default(false),
});

export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  namespace: z.string().min(1).max(63).optional(),
  requiresApproval: z.boolean().optional(),
});
