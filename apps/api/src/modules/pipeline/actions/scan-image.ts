import { NotImplementedError, type ActionContext, type ActionResult, type PipelineAction } from './types.js';

export const scanImageAction: PipelineAction = {
  name: 'scan:image',
  validate() {},
  async execute(_context: ActionContext): Promise<ActionResult> {
    throw new NotImplementedError('scan:image');
  },
};
