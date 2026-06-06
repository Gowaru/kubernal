import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const deployManifestAction: PipelineAction = {
  name: 'deploy:manifest',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('deploy:manifest');
  },
};
