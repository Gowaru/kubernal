import { NotFoundError } from '../../shared/errors.js';
import { db } from '../../shared/database.js';
import { applicationRepository } from './application.repository.js';

const DEFAULT_ENV_TYPES = [
  { type: 'dev', requiresApproval: false },
  { type: 'staging', requiresApproval: true },
  { type: 'prod', requiresApproval: true },
] as const;

export const applicationService = {
  async list() {
    return applicationRepository.findAll();
  },

  async getById(id: string) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return app;
  },

  async create(data: {
    name: string;
    description?: string;
    templateId: string;
    teamId: string;
    ownerId: string;
    repositoryUrl?: string;
    config?: Record<string, unknown>;
  }) {
    const template = await db.goldenPathTemplate.findUnique({
      where: { id: data.templateId },
      select: { repository: true, steps: true },
    });
    const team = await db.team.findUnique({
      where: { id: data.teamId },
      select: { namespacePrefix: true },
    });

    const hasScaffoldStep = Array.isArray(template?.steps) &&
      (template.steps as Array<Record<string, unknown>>).some((s) => s?.['action'] === 'scaffold:project');

    const { config, ...appData } = data;

    return db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          ...appData,
          status: 'active',
          config: (config ?? {}) as Record<string, never>,
          repositoryUrl: data.repositoryUrl ?? (hasScaffoldStep ? null : template?.repository ?? null),
        },
        include: { team: true, template: true, owner: true },
      });

      await tx.environment.createMany({
        data: DEFAULT_ENV_TYPES.map((env) => ({
          applicationId: app.id,
          name: `${data.name}-${env.type}`,
          type: env.type,
          namespace: `${team?.namespacePrefix ?? 'default'}-${data.name}-${env.type}`.slice(0, 63),
          clusterName: 'kubernal',
          requiresApproval: env.requiresApproval,
        })),
      });

      return tx.application.findUniqueOrThrow({
        where: { id: app.id },
        include: { team: true, template: true, owner: true, environments: true },
      });
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      repositoryUrl?: string | null;
      status?: string;
    },
  ) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.update(id, data);
  },

  async delete(id: string) {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.delete(id);
  },
};
