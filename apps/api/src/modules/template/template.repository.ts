import type { GoldenPathTemplate } from '@prisma/client';
import { db } from '../../shared/database.js';
import { toJsonValue } from '../../shared/json.js';

export const templateRepository = {
  findAll(): Promise<GoldenPathTemplate[]> {
    return db.goldenPathTemplate.findMany();
  },

  findById(id: string): Promise<GoldenPathTemplate | null> {
    return db.goldenPathTemplate.findUnique({ where: { id } });
  },

  create(data: {
    name: string;
    version?: string;
    category: string;
    description: string;
    repository: string;
    parameters?: Record<string, unknown>;
    steps?: Record<string, unknown>[];
  }): Promise<GoldenPathTemplate> {
    return db.goldenPathTemplate.create({
      data: {
        ...data,
        parameters: toJsonValue(data.parameters ?? {}),
        steps: toJsonValue(data.steps ?? []),
      },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      version?: string;
      description?: string;
      repository?: string;
      parameters?: Record<string, unknown>;
      steps?: Record<string, unknown>[];
    },
  ): Promise<GoldenPathTemplate> {
    const { parameters, steps, ...rest } = data;
    return db.goldenPathTemplate.update({
      where: { id },
      data: {
        ...rest,
        ...(parameters !== undefined ? { parameters: toJsonValue(parameters) } : {}),
        ...(steps !== undefined ? { steps: toJsonValue(steps) } : {}),
      },
    });
  },

  delete(id: string): Promise<GoldenPathTemplate> {
    return db.goldenPathTemplate.delete({ where: { id } });
  },
};
