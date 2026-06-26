import { execSync } from 'node:child_process';
import { logger } from '../logger.js';

export interface ImageRef {
  registry: string;
  owner: string;
  name: string;
  tag: string;
  fullRef: string;
}

const GHCR_REGISTRY = 'ghcr.io';

export function buildImageRef(owner: string, appName: string, envType: string, sha: string): string {
  const envSlug = envType.toLowerCase();
  return `${GHCR_REGISTRY}/${owner.toLowerCase()}/${appName.toLowerCase()}-${envSlug}:${sha}`;
}

export function parseImageRef(ref: string): ImageRef | null {
  const match = ref.match(/^(?:([^/]+)\/)?([^/:]+)\/([^/:]+):(.+)$/);
  if (!match) return null;
  const registry = match[1] ?? 'docker.io';
  const owner = match[2] ?? 'library';
  const name = match[3] ?? '';
  const tag = match[4] ?? 'latest';
  return { registry, owner, name, tag, fullRef: ref };
}

export function isGHCR(ref: string): boolean {
  return ref.startsWith(`${GHCR_REGISTRY}/`);
}

export function checkGHCRLogin(): boolean {
  try {
    const configPath = `${process.env.HOME}/.docker/config.json`;
    const configRaw = execSync(`test -f ${configPath} && cat ${configPath}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const config = JSON.parse(configRaw) as { auths?: Record<string, unknown> };
    const hasGHCR = !!config.auths && 'ghcr.io' in config.auths;
    if (hasGHCR) {
      logger.debug('GHCR login detected via ~/.docker/config.json');
    }
    return hasGHCR;
  } catch {
    return false;
  }
}

export function dockerTag(sourceRef: string, targetRef: string): void {
  logger.info({ source: sourceRef, target: targetRef }, 'Tagging image');
  execSync(`docker tag ${sourceRef} ${targetRef}`, { stdio: 'pipe' });
}

export function dockerPush(ref: string): void {
  logger.info({ ref }, 'Pushing image to registry');
  execSync(`docker push ${ref}`, { stdio: 'inherit' });
}

export function dockerPull(ref: string): void {
  logger.info({ ref }, 'Pulling image');
  execSync(`docker pull ${ref}`, { stdio: 'pipe' });
}
