import { db } from '../../shared/database.js';
import { toJsonArray } from '../../shared/json.js';

export const deploymentRepository = {
  findAll() {
    return db.deployment.findMany({
      include: { application: true, environment: true, approvedBy: true, pipelines: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return db.deployment.findUnique({
      where: { id },
      include: { application: true, environment: true, approvedBy: true, pipelines: true },
    });
  },

  findByApplication(applicationId: string) {
    return db.deployment.findMany({
      where: { applicationId },
      include: { environment: true, approvedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByEnvironment(environmentId: string) {
    return db.deployment.findMany({
      where: { environmentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  create(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
    trigger?: string;
    status?: string;
  }) {
    return db.deployment.create({
      data,
      include: { application: true, environment: true, pipelines: true },
    });
  },

  updateStatus(id: string, status: string, completedAt?: Date) {
    return db.deployment.update({
      where: { id },
      data: { status, ...(completedAt ? { completedAt } : {}) },
    });
  },

  approve(id: string, approvedById: string) {
    return db.deployment.update({
      where: { id },
      data: { approvedById, status: 'deploying' },
    });
  },

  savePolicyViolations(id: string, violations: Record<string, unknown>[]) {
    return db.deployment.update({
      where: { id },
      data: { policyViolations: toJsonArray(violations) },
    });
  },

  delete(id: string) {
    return db.deployment.delete({ where: { id } });
  },
};
