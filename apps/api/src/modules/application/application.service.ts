import type { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { db } from '../../shared/database.js';
import { applicationRepository } from './application.repository.js';
import type { AppListQuery } from './application.repository.js';
import { auditService } from '../audit/audit.service.js';
import { publicApplicationWithRelationsSelect } from '../../shared/serializers.js';

/** Sanitized projection reused by the transactional create below. */
const CREATE_SELECT = {
  ...publicApplicationWithRelationsSelect,
  environments: true,
} as const satisfies Prisma.ApplicationSelect;

type AppRow = Prisma.ApplicationGetPayload<{ select: typeof CREATE_SELECT }>;
type AppListRow = Awaited<ReturnType<typeof applicationRepository.findAll>>[number];
/** Sanitized detail row returned by the repository (owner included, never its hash). */
type AppDetailRow = NonNullable<Awaited<ReturnType<typeof applicationRepository.findById>>>;

const DEFAULT_ENV_TYPES = [
  { type: 'dev', requiresApproval: false },
  { type: 'staging', requiresApproval: true },
  { type: 'prod', requiresApproval: true },
] as const;

/**
 * Normalise `config.git` avant écriture :
 *  - `git` absent / `path` vide → la clé est retirée (mode Argo désactivé,
 *    c'est exactement le signal lu par `resolveDeploymentMode`) ;
 *  - `branch` vide/absente → omise (le backend applique le défaut `main`).
 *
 * @throws ValidationError si `git` n'est pas un objet exploitable.
 */
export function normalizeGitConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!('git' in config)) return config;
  const git = config.git;
  const { git: _removed, ...rest } = config;
  void _removed;
  if (git === undefined || git === null) return rest;
  if (typeof git !== 'object' || Array.isArray(git)) {
    throw new ValidationError('config.git doit être un objet { branch, path }');
  }
  const g = git as Record<string, unknown>;
  const path = typeof g.path === 'string' ? g.path.trim() : '';
  if (!path) return rest;
  const branch = typeof g.branch === 'string' ? g.branch.trim() : '';
  return { ...rest, git: { ...(branch ? { branch } : {}), path } };
}

export const applicationService = {
  async list(q?: AppListQuery): Promise<{ data: AppListRow[]; total: number }> {
    if (q?.search || q?.teamId || q?.status || q?.templateId || q?.page) {
      return applicationRepository.findAllPaginated(q);
    }
    const data = await applicationRepository.findAll();
    return { data, total: data.length };
  },

  async getById(id: string): Promise<AppDetailRow> {
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
  }): Promise<AppRow> {
    const template = await db.goldenPathTemplate.findUnique({
      where: { id: data.templateId },
      select: { repository: true, steps: true },
    });
    const team = await db.team.findUnique({
      where: { id: data.teamId },
      select: { namespacePrefix: true },
    });

    const hasScaffoldStep =
      Array.isArray(template?.steps) &&
      (template.steps as Array<Record<string, unknown>>).some(
        (s) => s?.['action'] === 'scaffold:project',
      );

    const { config, ...appData } = data;

    return db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          ...appData,
          status: 'active',
          config: (config ?? {}) as Record<string, never>,
          repositoryUrl:
            data.repositoryUrl ?? (hasScaffoldStep ? null : (template?.repository ?? null)),
        },
        select: { id: true },
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

      const created = await tx.application.findUniqueOrThrow({
        where: { id: app.id },
        select: CREATE_SELECT,
      });
      auditService
        .log({
          action: 'CREATE',
          resource: 'Application',
          resourceId: app.id,
          details: { name: data.name, templateId: data.templateId } as Record<string, unknown>,
        })
        .catch(() => {});
      return created;
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      repositoryUrl?: string | null;
      status?: string;
      archivedAt?: Date | null;
      config?: Record<string, unknown>;
    },
  ): Promise<AppRow> {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);

    const config = data.config !== undefined ? normalizeGitConfig(data.config) : undefined;
    const effectiveRepositoryUrl =
      data.repositoryUrl !== undefined ? data.repositoryUrl : app.repositoryUrl;
    if (config && 'git' in config && !effectiveRepositoryUrl) {
      throw new ValidationError(
        'Une configuration Git (config.git) nécessite un dépôt Git (repositoryUrl)',
      );
    }

    const result = await applicationRepository.update(id, {
      ...data,
      ...(config !== undefined ? { config } : {}),
    });
    auditService
      .log({
        action: 'UPDATE',
        resource: 'Application',
        resourceId: id,
        details: data as Record<string, unknown>,
      })
      .catch(() => {});
    return result;
  },

  async delete(id: string): Promise<AppRow> {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    const result = await applicationRepository.delete(id);
    auditService
      .log({
        action: 'DELETE',
        resource: 'Application',
        resourceId: id,
      })
      .catch(() => {});
    return result;
  },

  async archive(id: string): Promise<AppRow> {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.update(id, { archivedAt: new Date() });
  },

  async unarchive(id: string): Promise<AppRow> {
    const app = await applicationRepository.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return applicationRepository.update(id, { archivedAt: null });
  },
};
