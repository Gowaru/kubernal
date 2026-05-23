import { db } from '../../shared/database.js';
import { toJsonValue } from '../../shared/json.js';

export const policyRepository = {
  findAll() {
    return db.securityPolicy.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string) {
    return db.securityPolicy.findUnique({ where: { id } });
  },

  findEnabled() {
    return db.securityPolicy.findMany({ where: { enabled: true } });
  },

  create(data: {
    name: string;
    description: string;
    category: string;
    severity: string;
    engine: string;
    rules?: Record<string, unknown>;
    enabled?: boolean;
  }) {
    return db.securityPolicy.create({
      data: {
        ...data,
        rules: toJsonValue(data.rules ?? {}),
        enabled: data.enabled ?? true,
      },
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: string;
      severity?: string;
      rules?: Record<string, unknown>;
      enabled?: boolean;
    },
  ) {
    const { rules, ...rest } = data;
    return db.securityPolicy.update({
      where: { id },
      data: {
        ...rest,
        ...(rules !== undefined ? { rules: toJsonValue(rules) } : {}),
      },
    });
  },

  delete(id: string) {
    return db.securityPolicy.delete({ where: { id } });
  },
};
