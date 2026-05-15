import { z } from "zod";

export const createApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  templateId: z.string().uuid(),
  teamId: z.string().uuid(),
  ownerId: z.string().uuid(),
  repositoryUrl: z.string().url().optional(),
});

export const updateApplicationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  repositoryUrl: z.string().url().nullable().optional(),
  status: z.enum(["creating", "active", "failed", "archived"]).optional(),
});
