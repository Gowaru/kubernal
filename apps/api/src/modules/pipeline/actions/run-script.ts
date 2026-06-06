import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const runScriptAction: PipelineAction = {
  name: 'run:script',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('run:script');
  },
};
