import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const buildImageAction: PipelineAction = {
  name: 'build:image',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('build:image');
  },
};
