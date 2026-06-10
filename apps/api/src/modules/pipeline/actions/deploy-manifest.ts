import * as yaml from 'js-yaml';
import { execFile } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

function validateOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`deploy:manifest: params.${field} must be a non-empty string when provided`);
  }
  return value;
}

function validateOptionalBoolean(value: unknown, field: string, defaultVal: boolean): boolean {
  if (value === undefined) return defaultVal;
  if (typeof value !== 'boolean') {
    throw new Error(`deploy:manifest: params.${field} must be a boolean`);
  }
  return value;
}

function validateOptionalPositiveInt(value: unknown, field: string, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`deploy:manifest: params.${field} must be a positive number when provided`);
  }
  return Math.min(value, max);
}

function parseDeployParams(raw: Record<string, unknown>, workspaceDir?: string): {
  manifests: string[];
  manifestDir?: string;
  namespace?: string;
  kubeconfig?: string;
  waitRollout: boolean;
  rolloutTimeoutMs: number;
  prune: boolean;
} {
  const rawManifests = raw['manifests'];
  const manifestDirRaw = typeof raw['manifestDir'] === 'string' && raw['manifestDir'].length > 0
    ? raw['manifestDir']
    : undefined;
  let manifestDir: string | undefined;
  if (manifestDirRaw && workspaceDir) {
    manifestDir = resolve(workspaceDir, manifestDirRaw);
  }

  if (!rawManifests && !manifestDir) {
    throw new Error('deploy:manifest: params.manifests or params.manifestDir is required');
  }
  const manifests = Array.isArray(rawManifests) ? rawManifests : (rawManifests ? [rawManifests] : []);
  const validManifests = manifests.every((m) => typeof m === 'string');
  if (!validManifests) {
    throw new Error('deploy:manifest: params.manifests must be a string or array of strings');
  }

  const namespace = validateOptionalString(raw['namespace'], 'namespace');
  const kubeconfig = validateOptionalString(raw['kubeconfig'], 'kubeconfig');
  const waitRollout = validateOptionalBoolean(raw['waitRollout'], 'waitRollout', true);
  const rolloutTimeoutMs = validateOptionalPositiveInt(raw['rolloutTimeoutMs'], 'rolloutTimeoutMs', 1_800_000) ?? 300_000;
  const prune = validateOptionalBoolean(raw['prune'], 'prune', false);

  return { manifests, manifestDir, namespace, kubeconfig, waitRollout, rolloutTimeoutMs, prune };
}

async function deployManifestActionExecute(context: ActionContext): Promise<ActionResult> {
  const params = parseDeployParams(context.stepParams, context.workspaceDir);
  const { manifests: rawManifests, manifestDir, namespace: overrideNs, kubeconfig, waitRollout, rolloutTimeoutMs, prune } = params;

  let manifests = [...rawManifests];
  if (manifestDir) {
    if (existsSync(manifestDir)) {
      const files = readdirSync(manifestDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
      context.logger.info(`Loading ${files.length} manifest(s) from ${manifestDir}`);
      for (const file of files) {
        const content = readFileSync(join(manifestDir, file), 'utf-8');
        manifests.push(content);
      }
    } else {
      context.logger.warn(`manifestDir '${manifestDir}' does not exist`);
    }
  }

  if (manifests.length === 0) {
    throw new Error('deploy:manifest: no manifests to deploy');
  }

  const targetNs = overrideNs ?? context.environment?.namespace;
  if (!targetNs) {
    throw new Error('deploy:manifest: no namespace provided and environment.namespace is missing');
  }

  context.logger.info(`Deploying ${manifests.length} manifest(s) to namespace ${targetNs}`);

  const start = Date.now();
  const appliedResources: string[] = [];

  for (const manifest of manifests) {
    const docs = yaml.loadAll(manifest) as Record<string, unknown>[];
    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      const kind = doc['kind'] as string;
      const metadata = doc['metadata'] as Record<string, unknown>;
      const name = metadata?.['name'] as string;
      if (kind && name) {
        appliedResources.push(`${kind}/${name}`);
      }
    }
  }

  const combinedManifest = manifests.join('\n---\n');
  context.logger.info(`Applying ${manifests.length} manifest(s) to ${targetNs}`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'kubernal-deploy-'));
  const manifestFile = join(tmpDir, 'manifest.yaml');
  writeFileSync(manifestFile, combinedManifest, 'utf8');

  const args = ['apply', '-f', manifestFile];
  if (targetNs) args.push('-n', targetNs);
  if (kubeconfig) args.push('--kubeconfig', kubeconfig);
  if (prune) args.push('--prune', '-l', 'kubernal.io/managed-by=kubernal');

  const result = await execFileAsync('kubectl', args, {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120_000,
  });

  if (result.stderr) {
    context.logger.warn(`kubectl apply stderr: ${result.stderr.trim()}`);
  }

  try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

  if (waitRollout) {
    const deployments = combinedManifest
      .split(/^---$/m)
      .map((y) => yaml.load(y) as Record<string, unknown>)
      .filter((d) => d?.['kind'] === 'Deployment')
      .map((d) => (d?.['metadata'] as Record<string, unknown>)?.['name'] as string)
      .filter((n): n is string => typeof n === 'string');

    for (const dep of deployments) {
      context.logger.info(`Waiting for rollout of deployment ${dep} in ${targetNs}`);
      const rolloutArgs = ['rollout', 'status', `deployment/${dep}`, '-n', targetNs, `--timeout=${Math.ceil(rolloutTimeoutMs / 1000)}s`];
      if (kubeconfig) rolloutArgs.push('--kubeconfig', kubeconfig);
      try {
        await execFileAsync('kubectl', rolloutArgs, { timeout: rolloutTimeoutMs + 30_000 });
        context.logger.info(`Rollout complete for ${dep}`);
      } catch (err) {
        throw new Error(`Rollout failed for ${dep}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const durationMs = Date.now() - start;
  const output = {
    appliedResources,
    namespace: targetNs,
    rolloutStatus: waitRollout ? 'complete' : 'skipped',
    durationMs,
  };

  return {
    output,
    artifacts: [{ name: 'manifest', url: `k8s://${targetNs}/...` }],
  };
}

export const deployManifestAction: PipelineAction = {
  name: 'deploy:manifest',
  validate(raw: Record<string, unknown>) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('deploy:manifest: params must be an object');
    }
    if (!raw['manifests'] && !raw['manifestDir']) {
      throw new Error('deploy:manifest: params.manifests or params.manifestDir is required');
    }
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    return deployManifestActionExecute(context);
  },
};