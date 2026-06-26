import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024;
const DEFAULT_RETRY_COUNT = 3;
const MAX_RETRY_COUNT = 5;
const DEFAULT_RETRY_DELAY_MS = 5_000;

interface PushImageParams {
  image: string;
  targetRegistry?: string;
  targetImage?: string;
  username?: string;
  password?: string;
  insecure: boolean;
  retryCount: number;
  retryDelayMs: number;
}

interface ExecFileFailure {
  stdout: string;
  stderr: string;
  code?: string | number;
  killed: boolean;
  signal?: string;
}

function readExecFileError(err: unknown): ExecFileFailure {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    const code = e['code'];
    return {
      stdout: typeof e['stdout'] === 'string' ? e['stdout'] : '',
      stderr: typeof e['stderr'] === 'string' ? e['stderr'] : '',
      code: typeof code === 'number' || typeof code === 'string' ? code : undefined,
      killed: e['killed'] === true,
      signal: typeof e['signal'] === 'string' ? e['signal'] : undefined,
    };
  }
  return { stdout: '', stderr: '', killed: false };
}

function truncate(value: string, maxBytes: number): string {
  const buf = Buffer.from(value, 'utf8');
  if (buf.length <= maxBytes) return buf.toString('utf8');
  return `${buf.subarray(0, maxBytes).toString('utf8')}\n[... truncated, ${buf.length - maxBytes} more bytes ...]`;
}

function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`push:image: params.${field} must be a non-empty string`);
  }
  return value;
}

function validateOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`push:image: params.${field} must be a non-empty string when provided`);
  }
  return value;
}

function validateOptionalPositiveInt(value: unknown, field: string, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`push:image: params.${field} must be a positive number when provided`);
  }
  return Math.min(value, max);
}

function validateBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') {
    throw new Error(`push:image: params.${field} must be a boolean`);
  }
  return value;
}

function parsePushImageParams(raw: Record<string, unknown>): PushImageParams {
  const image = validateString(raw['image'], 'image');
  const targetRegistry = validateOptionalString(raw['targetRegistry'], 'targetRegistry');
  const targetImage = validateOptionalString(raw['targetImage'], 'targetImage');
  const username = validateOptionalString(raw['username'], 'username');
  const password = validateOptionalString(raw['password'], 'password');
  if (username !== undefined && password === undefined) {
    throw new Error('push:image: params.password is required when username is provided');
  }
  const insecure = validateBoolean(raw['insecure'], 'insecure', false);
  const retryCount = validateOptionalPositiveInt(raw['retryCount'], 'retryCount', MAX_RETRY_COUNT) ?? DEFAULT_RETRY_COUNT;
  const retryDelayMs = validateOptionalPositiveInt(raw['retryDelayMs'], 'retryDelayMs', 60_000) ?? DEFAULT_RETRY_DELAY_MS;

  return {
    image,
    targetRegistry,
    targetImage,
    username,
    password,
    insecure,
    retryCount,
    retryDelayMs,
  };
}

function extractRegistryFromImage(image: string): string {
  const parts = image.split('/');
  const first = parts[0];
  if (first && parts.length >= 2 && (first.includes('.') || first.includes(':'))) {
    return first;
  }
  return 'docker.io';
}

async function ensureDockerAvailable(logger: ActionContext['logger']): Promise<void> {
  try {
    await execFileAsync('docker', ['--version'], { timeout: 10_000 });
  } catch (err: unknown) {
    const failure = readExecFileError(err);
    if (failure.code === 'ENOENT') {
      throw new Error('push:image: docker CLI not found in PATH. Install Docker to use this action.');
    }
    throw new Error(`push:image: failed to invoke docker --version: ${failure.stderr || '<no stderr>'}`);
  }
  logger.info('docker CLI detected');
}

function parseImageIdFromInspect(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length >= 12 && /^[0-9a-f]{12,64}$/i.test(trimmed)) {
    return trimmed;
  }
  const lines = stdout.split('\n');
  for (const line of lines) {
    const m = line.match(/^([0-9a-f]{12,64})$/i);
    if (m && m[1]) {
      return m[1];
    }
  }
  return null;
}

function parseDigestFromPushOutput(stdout: string): string | null {
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? '';
    const m = line.match(/^([a-z0-9]+(?:[._-][a-z0-9]+)*\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/i);
    if (m && m[0]) {
      return m[0];
    }
  }
  return null;
}

async function dockerTag(source: string, target: string, logger: ActionContext['logger']): Promise<void> {
  const args = ['tag', source, target];
  logger.info(`docker tag: ${source} -> ${target}`);
  const result = await execFileAsync('docker', args, { timeout: 30_000 });
  if (result.stderr) {
    logger.warn(`docker tag stderr: ${result.stderr.trim()}`);
  }
}

async function dockerLogin(registry: string, username: string, password: string, insecure: boolean, logger: ActionContext['logger']): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const args = ['login', registry, '-u', username, '--password-stdin'];
    if (insecure) args.push('--insecure');
    logger.info(`docker login: ${registry} (user: ${username})`);
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000 });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        if (stderr.trim()) logger.warn(`docker login stderr: ${stderr.trim()}`);
        resolve();
      } else {
        reject(new Error(`docker login failed (exit ${code}): ${stderr.trim()}`));
      }
    });
    child.stdin.write(password);
    child.stdin.end();
  });
}

async function dockerPush(image: string, timeoutMs: number, logger: ActionContext['logger']): Promise<{ stdout: string; stderr: string }> {
  const args = ['push', image];
  logger.info(`docker push: ${image}`);
  const result = await execFileAsync('docker', args, {
    maxBuffer: MAX_BUFFER_BYTES,
    timeout: timeoutMs,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

async function dockerInspect(image: string, logger: ActionContext['logger']): Promise<string> {
  const args = ['inspect', image, '--format', '{{.Id}}'];
  logger.info(`docker inspect: ${image}`);
  const result = await execFileAsync('docker', args, { timeout: 30_000 });
  return result.stdout;
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  retryCount: number,
  retryDelayMs: number,
  logger: ActionContext['logger'],
  operationName: string,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isLastAttempt = attempt === retryCount;
      if (!isLastAttempt) {
        logger.warn(`${operationName}: attempt ${attempt}/${retryCount} failed: ${lastError.message}. Retrying in ${retryDelayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else {
        logger.error(`${operationName}: all ${retryCount} attempts failed`);
      }
    }
  }
  throw lastError;
}

export const pushImageAction: PipelineAction = {
  name: 'push:image',
  validate(params) {
    parsePushImageParams(params);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const params = parsePushImageParams(context.stepParams);
    const startedAt = Date.now();

    await ensureDockerAvailable(context.logger);

    const sourceImage = params.image;
    const targetImage = params.targetImage ?? sourceImage;
    const registry = params.targetRegistry ?? extractRegistryFromImage(targetImage);

    if (params.username) {
      await executeWithRetry(
        () => dockerLogin(registry, params.username!, params.password!, params.insecure, context.logger),
        params.retryCount,
        params.retryDelayMs,
        context.logger,
        'docker login',
      );
    }

    if (targetImage !== sourceImage) {
      await dockerTag(sourceImage, targetImage, context.logger);
    }

    const pushResult = await executeWithRetry(
      () => dockerPush(targetImage, DEFAULT_TIMEOUT_MS, context.logger),
      params.retryCount,
      params.retryDelayMs,
      context.logger,
      'docker push',
    );

    const durationMs = Date.now() - startedAt;

    let imageId: string | null = null;
    try {
      const inspectOutput = await dockerInspect(targetImage, context.logger);
      imageId = parseImageIdFromInspect(inspectOutput);
    } catch {
      const digest = parseDigestFromPushOutput(pushResult.stdout);
      if (digest) {
        imageId = digest;
      }
    }

    context.logger.info(
      `push:image: pushed '${targetImage}' in ${durationMs}ms` +
      (imageId ? ` (id=${imageId})` : ' (id not parsed)'),
    );

    const stdoutTruncated = truncate(pushResult.stdout, MAX_OUTPUT_BYTES);
    const stderrTruncated = truncate(pushResult.stderr, MAX_OUTPUT_BYTES);

    return {
      output: {
        pushedImage: targetImage,
        imageId: imageId ?? null,
        registry,
        sourceImage,
        targetImage: targetImage !== sourceImage ? targetImage : null,
        durationMs,
        stdoutTruncated,
        stderrTruncated,
      },
      artifacts: [
        { name: 'image', url: `docker://${targetImage}` },
      ],
    };
  },
};