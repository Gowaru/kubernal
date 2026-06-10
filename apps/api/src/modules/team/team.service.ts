import type { Team } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { teamRepository } from './team.repository.js';
import { logger } from '../../shared/logger.js';
import {
  getNamespaceLabels,
  ensureNamespace,
  ensureResourceQuota,
  ensureLimitRange,
  splitQuota,
  getTeamNamespaceNames,
  TEAM_ENVIRONMENTS,
  coreApi,
} from '../../shared/k8s-client.js';

export const teamService = {
  async list(): Promise<Team[]> {
    return teamRepository.findAll();
  },

  async getById(id: string): Promise<Team> {
    const team = await teamRepository.findById(id);
    if (!team) throw new NotFoundError('Team', id);
    return team;
  },

  async create(data: {
    name: string;
    description?: string;
    quotaCpu?: string;
    quotaMemory?: string;
    namespacePrefix: string;
  }): Promise<Team> {
    const existing = await teamRepository.findByName(data.name);
    if (existing) throw new ConflictError(`Team '${data.name}' already exists`);

    const team = await teamRepository.create(data);

    await provisionTeamEnvironments(team.id, team.name, team.namespacePrefix, data.quotaCpu, data.quotaMemory);

    return team;
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null; quotaCpu?: string; quotaMemory?: string },
  ): Promise<Team> {
    const team = await this.getById(id);
    const updated = await teamRepository.update(id, data);

    const cpu = data.quotaCpu ?? team.quotaCpu;
    const memory = data.quotaMemory ?? team.quotaMemory;
    const splits = splitQuota(cpu, memory);

    for (const [i, env] of TEAM_ENVIRONMENTS.entries()) {
      const ns = `${team.namespacePrefix}-${env.type}`;
      const split = splits[i]!;
      await ensureResourceQuota(ns, `${ns}-quota`, split.cpu, split.memory);
    }

    return updated;
  },

  async delete(id: string): Promise<void> {
    const team = await this.getById(id);
    await teamRepository.delete(id);

    const namespaces = getTeamNamespaceNames(team.namespacePrefix);
    for (const ns of namespaces) {
      try {
        await coreApi.deleteNamespace({ name: ns });
        logger.info({ namespace: ns }, 'Team namespace deleted');
      } catch (err) {
        logger.warn({ namespace: ns, err }, 'Could not delete team namespace');
      }
    }
  },
};

async function provisionTeamEnvironments(
  teamId: string,
  teamName: string,
  namespacePrefix: string,
  quotaCpu = '4',
  quotaMemory = '8Gi',
): Promise<void> {
  const labels = getNamespaceLabels(teamName, teamId);
  const splits = splitQuota(quotaCpu, quotaMemory);

  for (const [i, env] of TEAM_ENVIRONMENTS.entries()) {
    const ns = `${namespacePrefix}-${env.type}`;
    const envLabels = { ...labels, 'kubernal.io/environment': env.type };
    const split = splits[i]!;

    await ensureNamespace(ns, envLabels);
    await ensureResourceQuota(ns, `${ns}-quota`, split.cpu, split.memory);
    await ensureLimitRange(ns);

    logger.info({ namespace: ns, team: teamName, environment: env.type }, 'Team environment provisioned');
  }
}
