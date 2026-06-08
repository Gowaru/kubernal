import { db } from '../../shared/database.js';
import { NotFoundError } from '../../shared/errors.js';
import { toJsonValue } from '../../shared/json.js';
import { getAction } from './actions/registry.js';
import type { ActionContext, ActionArtifact } from './actions/types.js';

function makeLogger(pipelineId: string): ActionContext['logger'] {
  return {
    info: (msg: string) => process.stdout.write(`[pipeline ${pipelineId}] ${msg}\n`),
    warn: (msg: string) => console.warn(`[pipeline ${pipelineId}] ${msg}`),
    error: (msg: string) => console.error(`[pipeline ${pipelineId}] ${msg}`),
  };
}

function workspaceDirFor(pipelineId: string): string {
  return `/tmp/kubernal-pipeline-${pipelineId}`;
}

function truncate(value: string, max = 1000): string {
  return value.length > max ? value.slice(0, max) : value;
}

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return truncate(err.message);
  return truncate(String(err));
}

async function appendDeploymentArtifacts(
  deploymentId: string,
  artifacts: ActionArtifact[],
): Promise<void> {
  if (artifacts.length === 0) return;
  const current = await db.deployment.findUnique({
    where: { id: deploymentId },
    select: { artifacts: true },
  });
  const currentArr = Array.isArray(current?.artifacts)
    ? (current!.artifacts as unknown[])
    : [];
  await db.deployment.update({
    where: { id: deploymentId },
    data: { artifacts: toJsonValue([...currentArr, ...artifacts]) },
  });
}

export async function executePipeline(pipelineId: string): Promise<void> {
  const pipeline = await db.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      deployment: { include: { application: true, environment: true } },
      steps: { orderBy: { order: 'asc' } },
    },
  });
  if (!pipeline) throw new NotFoundError('Pipeline', pipelineId);

  const now = new Date();
  await db.pipeline.update({
    where: { id: pipelineId },
    data: {
      status: 'running',
      ...(pipeline.startedAt ? {} : { startedAt: now }),
    },
  });

  const logger = makeLogger(pipelineId);
  logger.info(
    `Starting pipeline with ${pipeline.steps.length} step(s) for deployment ${pipeline.deploymentId}`,
  );

  for (const step of pipeline.steps) {
    const stepStart = new Date();
    await db.pipelineStep.update({
      where: { id: step.id },
      data: { status: 'running', startedAt: stepStart },
    });

    let action;
    try {
      action = getAction(step.action);
    } catch (err) {
      const message = errorMessageOf(err);
      logger.error(`Step ${step.order} (${step.name}) unknown action '${step.action}': ${message}`);
      await db.pipelineStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await db.pipeline.update({
        where: { id: pipelineId },
        data: { status: 'failed', completedAt: new Date() },
      });
      return;
    }

    const env = pipeline.deployment.environment;
    const context: ActionContext = {
      pipelineId,
      deploymentId: pipeline.deploymentId,
      applicationId: pipeline.deployment.applicationId,
      workspaceDir: workspaceDirFor(pipelineId),
      stepParams: (step.params ?? {}) as Record<string, unknown>,
      stepOutput: step.output,
      logger: makeLogger(pipelineId),
      environment: env
        ? { id: env.id, name: env.name, type: env.type, namespace: env.namespace }
        : undefined,
    };

    try {
      action.validate(context.stepParams);
    } catch (err) {
      const message = errorMessageOf(err);
      logger.error(`Step ${step.order} (${step.name}) validation failed: ${message}`);
      await db.pipelineStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await db.pipeline.update({
        where: { id: pipelineId },
        data: { status: 'failed', completedAt: new Date() },
      });
      return;
    }

    logger.info(`Step ${step.order} (${step.name}) running action '${action.name}'`);
    try {
      const result = await action.execute(context);
      await db.pipelineStep.update({
        where: { id: step.id },
        data: {
          status: 'success',
          output: toJsonValue(result.output),
          completedAt: new Date(),
        },
      });
      if (result.artifacts && result.artifacts.length > 0) {
        await appendDeploymentArtifacts(pipeline.deploymentId, result.artifacts);
        logger.info(
          `Step ${step.order} attached ${result.artifacts.length} artifact(s) to deployment`,
        );
      }
      logger.info(`Step ${step.order} (${step.name}) succeeded`);
    } catch (err) {
      const message = errorMessageOf(err);
      logger.error(`Step ${step.order} (${step.name}) failed: ${message}`);
      await db.pipelineStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      await db.pipeline.update({
        where: { id: pipelineId },
        data: { status: 'failed', completedAt: new Date() },
      });
      return;
    }
  }

  await db.pipeline.update({
    where: { id: pipelineId },
    data: { status: 'success', completedAt: new Date() },
  });
  logger.info('Pipeline completed successfully');
}

export async function executeStep(stepId: string): Promise<void> {
  const step = await db.pipelineStep.findUnique({
    where: { id: stepId },
    include: { pipeline: { include: { deployment: { include: { environment: true } } } } },
  });
  if (!step) throw new NotFoundError('PipelineStep', stepId);

  const action = getAction(step.action);
  const env = step.pipeline.deployment.environment;
  const context: ActionContext = {
    pipelineId: step.pipelineId,
    deploymentId: step.pipeline.deploymentId,
    applicationId: step.pipeline.deployment.applicationId,
    workspaceDir: workspaceDirFor(step.pipelineId),
    stepParams: (step.params ?? {}) as Record<string, unknown>,
    stepOutput: step.output,
    logger: makeLogger(step.pipelineId),
    environment: env
      ? { id: env.id, name: env.name, type: env.type, namespace: env.namespace }
      : undefined,
  };

  await db.pipelineStep.update({
    where: { id: stepId },
    data: { status: 'running', startedAt: new Date() },
  });

  try {
    action.validate(context.stepParams);
    const result = await action.execute(context);
    await db.pipelineStep.update({
      where: { id: stepId },
      data: {
        status: 'success',
        output: toJsonValue(result.output),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await db.pipelineStep.update({
      where: { id: stepId },
      data: {
        status: 'failed',
        errorMessage: errorMessageOf(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

export async function claimNextPendingPipeline(): Promise<string | null> {
  const pending = await db.pipeline.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!pending) return null;
  const result = await db.pipeline.updateMany({
    where: { id: pending.id, status: 'pending' },
    data: { status: 'running' },
  });
  return result.count > 0 ? pending.id : null;
}
