import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(["backend", "frontend", "fullstack", "library", "function"]),
  description: z.string().min(1).max(1000),
  repository: z.string().url(),
  version: z.string().optional().default("1.0.0"),
  parameters: z.record(z.unknown()).optional(),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    action: z.string(),
    input: z.record(z.unknown()),
  })).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  version: z.string().optional(),
  description: z.string().max(1000).optional(),
  repository: z.string().url().optional(),
  parameters: z.record(z.unknown()).optional(),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    action: z.string(),
    input: z.record(z.unknown()),
  })).optional(),
});
