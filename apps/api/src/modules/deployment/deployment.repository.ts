import type { Deployment } from '@prisma/client';
import { db } from '../../shared/database.js';
import { toJsonArray } from '../../shared/json.js';

export const deploymentRepository = {
  findAll(): Promise<Deployment[]> {
    return db.deployment.findMany({
      include: { application: true, environment: true, approvedBy: true, pipelines: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string): Promise<Deployment | null> {
    return db.deployment.findUnique({
      where: { id },
      include: { application: true, environment: true, approvedBy: true, pipelines: true },
    });
  },

  findByApplication(applicationId: string): Promise<Deployment[]> {
    return db.deployment.findMany({
      where: { applicationId },
      include: { environment: true, approvedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findByEnvironment(environmentId: string): Promise<Deployment[]> {
    return db.deployment.findMany({
      where: { environmentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findLatestByApplication(applicationId: string): Promise<{ version: string } | null> {
    return db.deployment.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
  },

  create(data: {
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
    trigger?: string;
    status?: string;
  }): Promise<Deployment> {
    return db.deployment.create({
      data,
      include: { application: true, environment: true, pipelines: true },
    });
  },

  updateStatus(id: string, status: string, completedAt?: Date): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { status, ...(completedAt ? { completedAt } : {}) },
    });
  },

  approve(id: string, approvedById: string): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { approvedById, status: 'deploying' },
    });
  },

  savePolicyViolations(id: string, violations: Record<string, unknown>[]): Promise<Deployment> {
    return db.deployment.update({
      where: { id },
      data: { policyViolations: toJsonArray(violations) },
    });
  },

  delete(id: string): Promise<Deployment> {
    return db.deployment.delete({ where: { id } });
  },
};
