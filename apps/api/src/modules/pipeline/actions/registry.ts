import { buildImageAction } from './build-image.js';
import { deployManifestAction } from './deploy-manifest.js';
import { fetchTemplateAction } from './fetch-template.js';
import { provisionInfrastructureAction } from './provision-infrastructure.js';
import { pushImageAction } from './push-image.js';
import { runScriptAction } from './run-script.js';
import { scaffoldProjectAction } from './scaffold-project.js';
import { scanImageAction } from './scan-image.js';
import { tagGitAction } from './tag-git.js';
import type { PipelineAction } from './types.js';

const RETRY_CONFIG: Record<string, number> = {
  [buildImageAction.name]: 0,
  [pushImageAction.name]: 3,
  [scanImageAction.name]: 1,
  [deployManifestAction.name]: 2,
  [provisionInfrastructureAction.name]: 2,
  [runScriptAction.name]: 0,
  [fetchTemplateAction.name]: 1,
  [scaffoldProjectAction.name]: 0,
  [tagGitAction.name]: 1,
};

const REGISTRY: Record<string, PipelineAction> = {
  [fetchTemplateAction.name]: fetchTemplateAction,
  [provisionInfrastructureAction.name]: provisionInfrastructureAction,
  [runScriptAction.name]: runScriptAction,
  [buildImageAction.name]: buildImageAction,
  [pushImageAction.name]: pushImageAction,
  [scanImageAction.name]: scanImageAction,
  [deployManifestAction.name]: deployManifestAction,
  [scaffoldProjectAction.name]: scaffoldProjectAction,
  [tagGitAction.name]: tagGitAction,
};

export function getAction(name: string): PipelineAction {
  const action = REGISTRY[name];
  if (!action) {
    throw new Error(
      `Unknown action: ${name}. Known: ${Object.keys(REGISTRY).join(', ')}`,
    );
  }
  const maxRetries = RETRY_CONFIG[name] ?? 0;
  return { ...action, maxRetries };
}

export function listActions(): string[] {
  return Object.keys(REGISTRY);
}
