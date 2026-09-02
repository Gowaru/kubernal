import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_DOCKERFILE = 'Dockerfile';
const DEFAULT_PLATFORM = 'linux/amd64';
const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_TIMEOUT_MS = 1_800_000;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024;
const STDERR_ERROR_TRUNCATE = 2_000;

interface BuildImageParams {
  image: string;
  contextPath: string;
  dockerfile: string;
  platform: string;
  noCache: boolean;
  pull: boolean;
  target?: string;
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  timeoutMs: number;
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
    throw new Error(`build:image: params.${field} must be a non-empty string`);
  }
  return value;
}

function validateStringMap(value: unknown, field: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`build:image: params.${field} must be an object of string keys/values`);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`build:image: params.${field}.${k} must be a string`);
    }
    out[k] = v;
  }
  return out;
}

function validateOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`build:image: params.${field} must be a non-empty string when provided`);
  }
  return value;
}

function validateOptionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`build:image: params.${field} must be a positive number when provided`);
  }
  return Math.min(value, MAX_TIMEOUT_MS);
}

function validateBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') {
    throw new Error(`build:image: params.${field} must be a boolean`);
  }
  return value;
}

function parseBuildImageParams(raw: Record<string, unknown>): BuildImageParams {
  const image = validateString(raw['image'], 'image');
  const contextPath = validateOptionalString(raw['context'], 'context') ?? '';
  const dockerfile = validateOptionalString(raw['dockerfile'], 'dockerfile') ?? DEFAULT_DOCKERFILE;
  const platform = validateOptionalString(raw['platform'], 'platform') ?? DEFAULT_PLATFORM;
  const noCache = validateBoolean(raw['noCache'], 'noCache', false);
  const pull = validateBoolean(raw['pull'], 'pull', true);
  const target = validateOptionalString(raw['target'], 'target');
  const buildArgs = validateStringMap(raw['buildArgs'], 'buildArgs');
  const labels = validateStringMap(raw['labels'], 'labels');
  const timeoutMs =
    validateOptionalPositiveInt(raw['timeoutMs'], 'timeoutMs') ?? DEFAULT_TIMEOUT_MS;
  const params: BuildImageParams = {
    image,
    contextPath,
    dockerfile,
    platform,
    noCache,
    pull,
    timeoutMs,
  };
  if (target !== undefined) params.target = target;
  if (Object.keys(buildArgs).length > 0) params.buildArgs = buildArgs;
  if (Object.keys(labels).length > 0) params.labels = labels;
  return params;
}

async function resolveContext(params: BuildImageParams, workspaceDir: string): Promise<string> {
  if (params.contextPath.length > 0) {
    return path.resolve(params.contextPath);
  }
  const repoPath = path.join(workspaceDir, 'repo');
  try {
    const s = await stat(repoPath);
    if (s.isDirectory()) return repoPath;
  } catch {
    // repo directory does not exist, fall back to workspaceDir
  }
  return path.resolve(workspaceDir);
}

async function ensureDockerAvailable(logger: ActionContext['logger']): Promise<void> {
  try {
    await execFileAsync('docker', ['--version'], { timeout: 10_000 });
  } catch (err: unknown) {
    const failure = readExecFileError(err);
    if (failure.code === 'ENOENT') {
      throw new Error(
        'build:image: docker CLI not found in PATH. Install Docker to use this action.',
      );
    }
    throw new Error(
      `build:image: failed to invoke docker --version: ${failure.stderr || '<no stderr>'}`,
    );
  }
  logger.info('docker CLI detected');
}

function parseImageIdFromOutput(stdout: string): string | null {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const m = line.match(/^Successfully built\s+([0-9a-f]{12,64})/i);
    if (m && m[1]) {
      return m[1];
    }
  }
  return null;
}

export const buildImageAction: PipelineAction = {
  name: 'build:image',
  validate(params) {
    parseBuildImageParams(params);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const params = parseBuildImageParams(context.stepParams);
    const startedAt = Date.now();

    await ensureDockerAvailable(context.logger);

    const contextAbs = await resolveContext(params, context.workspaceDir);
    const contextStat = await stat(contextAbs).catch(() => null);
    if (!contextStat || !contextStat.isDirectory()) {
      throw new Error(
        `build:image: build context directory does not exist or is not a directory: ${contextAbs}`,
      );
    }

    const dockerfileAbs = path.isAbsolute(params.dockerfile)
      ? params.dockerfile
      : path.resolve(contextAbs, params.dockerfile);
    const dockerfileStat = await stat(dockerfileAbs).catch(() => null);
    if (!dockerfileStat || !dockerfileStat.isFile()) {
      throw new Error(
        `build:image: Dockerfile not found at '${dockerfileAbs}' (context='${contextAbs}', dockerfile='${params.dockerfile}')`,
      );
    }

    const args: string[] = [
      'build',
      '-t',
      params.image,
      '-f',
      dockerfileAbs,
      '--platform',
      params.platform,
    ];
    if (params.noCache) args.push('--no-cache');
    if (params.pull) args.push('--pull');
    if (params.target) {
      args.push('--target', params.target);
    }
    if (params.buildArgs) {
      for (const [k, v] of Object.entries(params.buildArgs)) {
        args.push('--build-arg', `${k}=${v}`);
      }
    }
    if (params.labels) {
      for (const [k, v] of Object.entries(params.labels)) {
        args.push('--label', `${k}=${v}`);
      }
    }
    args.push(contextAbs);

    context.logger.info(
      `docker build: image='${params.image}' context='${contextAbs}' dockerfile='${dockerfileAbs}' args=${args.length - 1}`,
    );

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let killed = false;
    let signal: string | undefined;

    try {
      const result = await execFileAsync('docker', args, {
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: params.timeoutMs,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: unknown) {
      const failure = readExecFileError(err);
      stdout = failure.stdout;
      stderr = failure.stderr;
      killed = failure.killed;
      signal = failure.signal;
      exitCode = typeof failure.code === 'number' ? failure.code : 1;
    }

    const durationMs = Date.now() - startedAt;

    if (exitCode !== 0) {
      const reason = killed ? `killed (signal=${signal ?? 'timeout'})` : `exitCode=${exitCode}`;
      const stderrHead =
        stderr.length > STDERR_ERROR_TRUNCATE
          ? `${stderr.slice(0, STDERR_ERROR_TRUNCATE)}...`
          : stderr;
      const stdoutHead =
        stdout.length > STDERR_ERROR_TRUNCATE
          ? `${stdout.slice(0, STDERR_ERROR_TRUNCATE)}...`
          : stdout;
      context.logger.error(`build:image: docker build failed (${reason})`);
      throw new Error(
        `build:image: docker build failed (${reason}): ${stderrHead || stdoutHead || '<no output>'}`,
      );
    }

    const imageId = parseImageIdFromOutput(stdout);
    context.logger.info(
      `build:image: built '${params.image}' in ${durationMs}ms` +
        (imageId ? ` (id=${imageId})` : ' (id not parsed)'),
    );

    const stdoutTruncated = truncate(stdout, MAX_OUTPUT_BYTES);
    const stderrTruncated = truncate(stderr, MAX_OUTPUT_BYTES);

    return {
      output: {
        image: params.image,
        imageId: imageId ?? null,
        dockerContext: contextAbs,
        dockerfile: dockerfileAbs,
        platform: params.platform,
        noCache: params.noCache,
        pull: params.pull,
        target: params.target ?? null,
        buildArgs: params.buildArgs ?? {},
        labels: params.labels ?? {},
        exitCode,
        durationMs,
        stdoutTruncated,
        stderrTruncated,
      },
      artifacts: [{ name: 'image', url: `docker://${params.image}` }],
    };
  },
};
