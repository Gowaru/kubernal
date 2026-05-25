import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { teamRepository } from './team.repository.js';
import { logger } from '../../shared/logger.js';
import {
  getNamespaceLabels,
  ensureNamespace,
  ensureResourceQuota,
  ensureLimitRange,
  coreApi,
} from '../../shared/k8s-client.js';

export const teamService = {
  async list() {
    return teamRepository.findAll();
  },

  async getById(id: string) {
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
  }) {
    const existing = await teamRepository.findByName(data.name);
    if (existing) throw new ConflictError(`Team '${data.name}' already exists`);

    const team = await teamRepository.create(data);

    await provisionTeamNamespace(team.id, team.name, team.namespacePrefix, data.quotaCpu, data.quotaMemory);

    return team;
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null; quotaCpu?: string; quotaMemory?: string },
  ) {
    const team = await this.getById(id);
    const updated = await teamRepository.update(id, data);

    await ensureResourceQuota(
      team.namespacePrefix,
      `${team.namespacePrefix}-quota`,
      data.quotaCpu ?? team.quotaCpu,
      data.quotaMemory ?? team.quotaMemory,
    );

    return updated;
  },

  async delete(id: string) {
    const team = await this.getById(id);
    await teamRepository.delete(id);

    try {
      await coreApi.deleteNamespace({ name: team.namespacePrefix });
      logger.info({ namespace: team.namespacePrefix }, 'Team namespace deleted');
    } catch (err) {
      logger.warn({ namespace: team.namespacePrefix, err }, 'Could not delete team namespace');
    }
  },
};

async function provisionTeamNamespace(
  teamId: string,
  teamName: string,
  namespacePrefix: string,
  quotaCpu = '4',
  quotaMemory = '8Gi',
) {
  const labels = getNamespaceLabels(teamName, teamId);

  await ensureNamespace(namespacePrefix, labels);
  await ensureResourceQuota(namespacePrefix, `${namespacePrefix}-quota`, quotaCpu, quotaMemory);
  await ensureLimitRange(namespacePrefix);

  logger.info({ namespace: namespacePrefix, team: teamName }, 'Team namespace provisioned');
}
