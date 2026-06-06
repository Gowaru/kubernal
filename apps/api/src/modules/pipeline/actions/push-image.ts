import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const pushImageAction: PipelineAction = {
  name: 'push:image',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('push:image');
  },
};
