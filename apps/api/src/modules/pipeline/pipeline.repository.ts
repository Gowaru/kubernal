import { db } from '../../shared/database.js';
import { toJsonValue } from '../../shared/json.js';

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

  addStep(
    pipelineId: string,
    step: {
      name: string;
      order: number;
      action: string;
      params?: Record<string, unknown>;
    },
  ) {
    return db.pipelineStep.create({
      data: {
        pipelineId,
        name: step.name,
        order: step.order,
        action: step.action,
        params: toJsonValue(step.params ?? {}),
        status: 'pending',
      },
    });
  },

  findStepsByPipeline(pipelineId: string) {
    return db.pipelineStep.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' },
    });
  },

  updateStep(
    stepId: string,
    data: {
      status?: string;
      output?: Record<string, unknown>;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    },
  ) {
    const { output, ...rest } = data;
    return db.pipelineStep.update({
      where: { id: stepId },
      data: {
        ...rest,
        ...(output !== undefined ? { output: toJsonValue(output) } : {}),
      },
    });
  },

  findPendingPipelines() {
    return db.pipeline.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  },
};
