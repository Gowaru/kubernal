import type { Request, Response } from 'express';
import { db } from '../../shared/database.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { listActions } from './actions/registry.js';
import { pipelineRepository } from './pipeline.repository.js';
import { pipelineService } from './pipeline.service.js';

interface TemplateStep {
  id?: string;
  name?: string;
  action?: string;
  input?: Record<string, unknown>;
}

function isTemplateStepArray(value: unknown): value is TemplateStep[] {
  return Array.isArray(value);
}

export const pipelineController = {
  async list(_req: Request, res: Response): Promise<void> {
    const pipelines = await pipelineService.list();
    res.json({ data: pipelines, total: pipelines.length });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const pipeline = await pipelineService.getById(id);
    res.json({ data: pipeline });
  },

  async create(req: Request, res: Response): Promise<void> {
    const pipeline = await pipelineService.create(req.body);
    res.status(201).json({ data: pipeline });
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body;
    const id = req.params.id as string;
    const pipeline = await pipelineService.updateStatus(id, status);
    res.json({ data: pipeline });
  },

  async executeFromTemplate(req: Request, res: Response): Promise<void> {
    const { deploymentId, templateId, params } = req.body as {
      deploymentId: string;
      templateId: string;
      params?: Record<string, unknown>;
    };

    const deployment = await db.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment) throw new NotFoundError('Deployment', deploymentId);

    const template = await db.goldenPathTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundError('Template', templateId);

    if (!isTemplateStepArray(template.steps) || template.steps.length === 0) {
      throw new ValidationError(`Template '${template.name}' has no steps defined`);
    }

    const application = await db.application.findUnique({
      where: { id: deployment.applicationId },
      select: { config: true, name: true },
    });
    const appConfig = (application?.config as Record<string, unknown>) ?? {};
    const registryHost = process.env['REGISTRY_HOST'] ?? 'localhost:5000';
    const computedParams: Record<string, unknown> = {
      name: application?.name ?? 'unknown',
      version: deployment.version,
      image: `${registryHost}/${application?.name ?? 'unknown'}:${deployment.version}`,
      imageTag: `${registryHost}/${application?.name ?? 'unknown'}:${deployment.version}`,
    };

    const pipeline = await db.pipeline.create({
      data: {
        deploymentId,
        name: `pipeline-${template.name}-${Date.now()}`,
        status: 'pending',
        stages: [],
      },
    });

    for (let i = 0; i < template.steps.length; i += 1) {
      const step = template.steps[i]!;
      const action = step.action ?? '';
      const stepName = step.name ?? step.id ?? `step-${i + 1}`;
      const stepParams = {
        ...(step.input ?? {}),
        ...appConfig,
        ...computedParams,
        ...params,
      };
      await pipelineRepository.addStep(pipeline.id, {
        name: stepName,
        order: i,
        action,
        params: stepParams,
      });
    }

    const created = await db.pipeline.findUnique({
      where: { id: pipeline.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({ data: created });
  },

  async getSteps(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const pipeline = await db.pipeline.findUnique({ where: { id } });
    if (!pipeline) throw new NotFoundError('Pipeline', id);
    const steps = await pipelineRepository.findStepsByPipeline(id);
    res.json({ data: steps, total: steps.length });
  },

  async streamEvents(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = async (): Promise<void> => {
      try {
        const pipeline = await pipelineService.getWithSteps(id);
        res.write(`data: ${JSON.stringify(pipeline)}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ error: 'Pipeline not found' })}\n\n`);
      }
    };

    await send();

    const interval = setInterval(send, 3000);

    req.on('close', () => {
      clearInterval(interval);
    });
  },

  async listAvailableActions(_req: Request, res: Response): Promise<void> {
    res.json({ data: listActions() });
  },
};
