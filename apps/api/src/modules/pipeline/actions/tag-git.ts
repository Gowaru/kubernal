import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db } from '../../../shared/database.js';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

function validateParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tag:git: missing required param '${key}'`);
  }
  return value;
}

export const tagGitAction: PipelineAction = {
  name: 'tag:git',

  validate(params: Record<string, unknown>): void {
    validateParam(params, 'repository');
    validateParam(params, 'commitSha');
    validateParam(params, 'version');
    const environment = params['environment'];
    if (environment !== undefined && typeof environment !== 'string') {
      throw new Error('tag:git: environment must be a string');
    }
  },

  async execute(context: ActionContext): Promise<ActionResult> {
    const { repository, commitSha, version, environment } = context.stepParams as {
      repository: string;
      commitSha: string;
      version: string;
      environment?: string;
    };

    const tagName = environment ? `deploy-${environment}-${version}` : `deploy-${version}`;

    context.logger.info(`tag:git: creating tag '${tagName}' on ${commitSha.slice(0, 7)}`);

    const application = await db.application.findUnique({
      where: { id: context.applicationId },
      select: { name: true },
    });
    const appName = application?.name ?? 'unknown';

    const sshUrl = repository.replace(/^https:\/\/github\.com\//, 'git@github.com:');
    const tmpDir = `/tmp/kubernal-tag-${context.pipelineId}`;

    try {
      await execFileAsync('git', ['clone', '--depth', '0', repository, tmpDir], {
        maxBuffer: 16 * 1024 * 1024,
        timeout: 60_000,
      });
      context.logger.info(`tag:git: cloned ${appName}`);

      await execFileAsync('git', ['config', 'user.name', 'kubernal-bot'], {
        cwd: tmpDir,
      });
      await execFileAsync('git', ['config', 'user.email', 'kubernal-bot@kubernal.dev'], {
        cwd: tmpDir,
      });

      await execFileAsync('git', ['fetch', '--depth', '1', 'origin', commitSha], {
        cwd: tmpDir,
        timeout: 30_000,
      });

      const tagMessage = `Deploy ${appName}@${version} (${environment ?? 'unknown'}) via Kubernal pipeline ${context.pipelineId}`;
      await execFileAsync('git', ['tag', '-a', tagName, commitSha, '-m', tagMessage], {
        cwd: tmpDir,
      });
      context.logger.info(`tag:git: tag '${tagName}' created locally`);

      await execFileAsync('git', ['push', 'origin', tagName], {
        cwd: tmpDir,
        timeout: 30_000,
      });
      context.logger.info(`tag:git: pushed '${tagName}' to origin`);
    } finally {
      try {
        const { rm } = await import('node:fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup best effort
      }
    }

    return {
      output: {
        tagName,
        commitSha,
        version,
        environment: environment ?? null,
        repository: sshUrl,
      },
      artifacts: [
        {
          name: `git-tag:${tagName}`,
          url: `${repository.replace(/\.git$/, '')}/releases/tag/${tagName}`,
          digest: commitSha,
        },
      ],
    };
  },
};
