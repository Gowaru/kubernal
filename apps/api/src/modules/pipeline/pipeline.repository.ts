import { db } from "../../shared/database.js";
import { toJsonValue } from "../../shared/json.js";

export const pipelineRepository = {
  findAll() {
    return db.pipeline.findMany({ include: { deployment: true } });
  },

  findById(id: string) {
    return db.pipeline.findUnique({ where: { id }, include: { deployment: true } });
  },

  findByDeployment(deploymentId: string) {
    return db.pipeline.findMany({ where: { deploymentId } });
  },

  create(data: {
    deploymentId: string;
    name: string;
    status?: string;
    stages?: Record<string, unknown>[];
    logsUrl?: string;
  }) {
    return db.pipeline.create({
      data: {
        ...data,
        stages: toJsonValue(data.stages ?? []),
      },
      include: { deployment: true },
    });
  },

  updateStatus(id: string, status: string, completedAt?: Date) {
    return db.pipeline.update({
      where: { id },
      data: { status, ...(completedAt ? { completedAt } : {}) },
    });
  },

  addStage(id: string, stage: Record<string, unknown>) {
    return db.pipeline.update({
      where: { id },
      data: { stages: { push: toJsonValue(stage) } },
    });
  },

  delete(id: string) {
    return db.pipeline.delete({ where: { id } });
  },
};
