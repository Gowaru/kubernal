import { buildImageAction } from './build-image.js';
import { deployManifestAction } from './deploy-manifest.js';
import { fetchTemplateAction } from './fetch-template.js';
import { provisionInfrastructureAction } from './provision-infrastructure.js';
import { pushImageAction } from './push-image.js';
import { runScriptAction } from './run-script.js';
import { scaffoldProjectAction } from './scaffold-project.js';
import { scanImageAction } from './scan-image.js';
import type { PipelineAction } from './types.js';

const REGISTRY: Record<string, PipelineAction> = {
  [fetchTemplateAction.name]: fetchTemplateAction,
  [provisionInfrastructureAction.name]: provisionInfrastructureAction,
  [runScriptAction.name]: runScriptAction,
  [buildImageAction.name]: buildImageAction,
  [pushImageAction.name]: pushImageAction,
  [scanImageAction.name]: scanImageAction,
  [deployManifestAction.name]: deployManifestAction,
  [scaffoldProjectAction.name]: scaffoldProjectAction,
};

export function getAction(name: string): PipelineAction {
  const action = REGISTRY[name];
  if (!action) {
    throw new Error(
      `Unknown action: ${name}. Known: ${Object.keys(REGISTRY).join(', ')}`,
    );
  }
  return action;
}

export function listActions(): string[] {
  return Object.keys(REGISTRY);
}
