import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

function ensureRepository(repository: unknown): string {
  if (typeof repository !== 'string' || repository.length === 0) {
    throw new Error('fetch:template: params.repository must be a non-empty string');
  }
  if (!/^https?:\/\//.test(repository)) {
    throw new Error('fetch:template: params.repository must be a valid http(s) URL');
  }
  return repository;
}

export const fetchTemplateAction: PipelineAction = {
  name: 'fetch:template',
  validate(params) {
    ensureRepository(params['repository']);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const repository = ensureRepository(context.stepParams['repository']);
    const targetPath = `${context.workspaceDir}/repo`;
    await mkdir(context.workspaceDir, { recursive: true });
    context.logger.info(`Cloning ${repository} into ${targetPath}`);
    await execFileAsync('git', ['clone', '--depth', '1', repository, targetPath], {
      maxBuffer: 16 * 1024 * 1024,
    });
    context.logger.info(`Clone complete: ${targetPath}`);
    return {
      output: {
        cloned: true,
        repository,
        path: targetPath,
      },
    };
  },
};
