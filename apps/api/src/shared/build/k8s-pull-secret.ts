import { execSync } from 'node:child_process';
import { logger } from '../logger.js';

export interface PullSecretSpec {
  name: string;
  namespace: string;
  registry: string;
  username: string;
  password: string;
}

export interface PullSecretResult {
  name: string;
  namespace: string;
  created: boolean;
  updated: boolean;
  alreadyExisted: boolean;
  error?: string;
}

function secretExists(namespace: string, name: string): boolean {
  try {
    execSync(`kubectl get secret ${name} -n ${namespace} -o name`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function patchServiceAccount(namespace: string, secretName: string): void {
  try {
    execSync(
      `kubectl patch serviceaccount default -n ${namespace} --type=merge -p='{"imagePullSecrets":[{"name":"${secretName}"}]}'`,
      { stdio: 'pipe' },
    );
    logger.debug({ namespace, secretName }, 'Patched serviceaccount with imagePullSecret');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ namespace, secretName, error: message }, 'Failed to patch serviceaccount (non-fatal)');
  }
}

export function createOrUpdatePullSecret(spec: PullSecretSpec): PullSecretResult {
  const exists = secretExists(spec.namespace, spec.name);

  try {
    if (exists) {
      logger.info({ name: spec.name, namespace: spec.namespace }, 'Updating existing pull secret');
      execSync(
        `kubectl create secret docker-registry ${spec.name} -n ${spec.namespace} ` +
          `--docker-server=${spec.registry} ` +
          `--docker-username=${spec.username} ` +
          `--docker-password=${spec.password} ` +
          '--docker-email=' + (process.env.GHCR_EMAIL ?? `${spec.username}@users.noreply.github.com`) +
          ' --dry-run=client -o yaml | kubectl apply -f -',
        { stdio: 'pipe' },
      );
      patchServiceAccount(spec.namespace, spec.name);
      return { name: spec.name, namespace: spec.namespace, created: false, updated: true, alreadyExisted: true };
    }

    logger.info({ name: spec.name, namespace: spec.namespace }, 'Creating new pull secret');
    execSync(
      `kubectl create secret docker-registry ${spec.name} -n ${spec.namespace} ` +
        `--docker-server=${spec.registry} ` +
        `--docker-username=${spec.username} ` +
        `--docker-password=${spec.password} ` +
        '--docker-email=' + (process.env.GHCR_EMAIL ?? `${spec.username}@users.noreply.github.com`),
      { stdio: 'pipe' },
    );
    patchServiceAccount(spec.namespace, spec.name);
    return { name: spec.name, namespace: spec.namespace, created: true, updated: false, alreadyExisted: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ spec, error: message }, 'Failed to create/update pull secret');
    return { name: spec.name, namespace: spec.namespace, created: false, updated: false, alreadyExisted: exists, error: message };
  }
}

export function ensureGHCRPullSecretInNamespace(
  namespace: string,
  username: string,
  password: string,
  secretName = 'ghcr-pull',
): PullSecretResult {
  return createOrUpdatePullSecret({
    name: secretName,
    namespace,
    registry: 'ghcr.io',
    username,
    password,
  });
}
