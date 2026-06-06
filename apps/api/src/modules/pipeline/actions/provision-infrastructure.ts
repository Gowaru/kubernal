import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const provisionInfrastructureAction: PipelineAction = {
  name: 'provision:infrastructure',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('provision:infrastructure');
  },
};
