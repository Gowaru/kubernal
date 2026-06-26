export interface ActionContext {
  pipelineId: string;
  deploymentId: string;
  applicationId: string;
  workspaceDir: string;
  stepParams: Record<string, unknown>;
  stepOutput: unknown;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  environment?: {
    id: string;
    name: string;
    type: string;
    namespace: string;
  };
}

export interface ActionArtifact {
  name: string;
  url?: string;
  digest?: string;
}

export interface ActionResult {
  output: Record<string, unknown>;
  artifacts?: ActionArtifact[];
}

export interface PipelineAction {
  readonly name: string;
  readonly maxRetries?: number;
  validate(params: Record<string, unknown>): void;
  execute(context: ActionContext): Promise<ActionResult>;
}

export class NotImplementedError extends Error {
  constructor(action: string) {
    super(`Action not implemented: ${action}`);
    this.name = 'NotImplementedError';
  }
}
