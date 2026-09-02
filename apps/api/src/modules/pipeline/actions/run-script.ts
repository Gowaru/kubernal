import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set<string>([
  'ls',
  'cat',
  'echo',
  'pwd',
  'mkdir',
  'rm',
  'cp',
  'mv',
  'touch',
  'find',
  'grep',
  'sed',
  'awk',
  'node',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'python',
  'python3',
  'pip',
  'pip3',
  'go',
  'cargo',
  'rustc',
  'make',
  'cmake',
  'docker',
  'git',
  'kubectl',
  'trivy',
]);

const ALLOWED_PATH_PREFIXES = ['/usr/bin/', '/usr/local/bin/', '/bin/', '/sbin/'] as const;

const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 1_800_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024;
const STDERR_ERROR_TRUNCATE = 1_000;
const SLOW_COMMAND_THRESHOLD_MS = 60_000;

interface RunScriptParams {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
}

interface ExecFileFailure {
  stdout: string;
  stderr: string;
  code?: number | string;
  killed: boolean;
  signal?: string;
}

function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`run:script: params.${field} must be a non-empty string`);
  }
  return value;
}

function validateArgs(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('run:script: params.args must be an array of strings');
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== 'string') {
      throw new Error(`run:script: params.args[${i}] must be a string`);
    }
    out.push(item);
  }
  return out;
}

function validateEnv(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('run:script: params.env must be an object of string keys/values');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`run:script: params.env.${k} must be a string`);
    }
    out[k] = v;
  }
  return out;
}

function validateTimeout(value: unknown): number {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('run:script: params.timeoutMs must be a positive number');
  }
  return Math.min(value, MAX_TIMEOUT_MS);
}

function isCommandAllowed(command: string): boolean {
  if (ALLOWED_COMMANDS.has(command)) return true;
  return ALLOWED_PATH_PREFIXES.some((p) => command.startsWith(p));
}

function parseRunScriptParams(raw: Record<string, unknown>): RunScriptParams {
  const command = validateString(raw['command'], 'command');
  if (!isCommandAllowed(command)) {
    const allowed = [...ALLOWED_COMMANDS].sort().join(', ');
    throw new Error(
      `run:script: params.command '${command}' is not in the whitelist. ` +
        `Allowed: ${allowed}, or absolute paths under ${ALLOWED_PATH_PREFIXES.join(', ')}`,
    );
  }
  const args = validateArgs(raw['args']);
  const cwd = raw['cwd'] !== undefined ? validateString(raw['cwd'], 'cwd') : undefined;
  const env = validateEnv(raw['env']);
  const timeoutMs = validateTimeout(raw['timeoutMs']);
  const result: RunScriptParams = { command, args, timeoutMs };
  if (cwd !== undefined) result.cwd = cwd;
  if (env !== undefined) result.env = env;
  return result;
}

function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

async function resolveCwd(params: RunScriptParams, workspaceDir: string): Promise<string> {
  if (params.cwd !== undefined) {
    const cwdResolved = path.resolve(params.cwd);
    const wsResolved = path.resolve(workspaceDir);
    if (!isPathInside(cwdResolved, wsResolved)) {
      throw new Error(
        `run:script: params.cwd '${params.cwd}' (resolved: ${cwdResolved}) ` +
          `must be within workspaceDir '${wsResolved}'`,
      );
    }
    return cwdResolved;
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

function truncateOutput(value: string, maxBytes: number): string {
  const buf = Buffer.from(value, 'utf8');
  if (buf.length <= maxBytes) return buf.toString('utf8');
  const head = buf.subarray(0, maxBytes).toString('utf8');
  return `${head}\n[... truncated, ${buf.length - maxBytes} more bytes ...]`;
}

export const runScriptAction: PipelineAction = {
  name: 'run:script',
  validate(params) {
    parseRunScriptParams(params);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const params = parseRunScriptParams(context.stepParams);
    const cwd = await resolveCwd(params, context.workspaceDir);
    const env: NodeJS.ProcessEnv = { ...process.env, ...(params.env ?? {}) };
    const startedAt = Date.now();
    context.logger.info(
      `run:script: executing '${params.command}' (args=${params.args.length}, cwd=${cwd})`,
    );

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let killed = false;
    let signal: string | undefined;

    try {
      const result = await execFileAsync(params.command, params.args, {
        cwd,
        env,
        timeout: params.timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
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
    if (durationMs > SLOW_COMMAND_THRESHOLD_MS) {
      context.logger.warn(
        `run:script: command '${params.command}' took ${durationMs}ms (threshold ${SLOW_COMMAND_THRESHOLD_MS}ms)`,
      );
    }

    if (exitCode !== 0) {
      const reason = killed ? `killed (signal=${signal ?? 'timeout'})` : `exitCode=${exitCode}`;
      const stderrHead =
        stderr.length > STDERR_ERROR_TRUNCATE
          ? `${stderr.slice(0, STDERR_ERROR_TRUNCATE)}...`
          : stderr;
      context.logger.error(`run:script: command '${params.command}' failed (${reason})`);
      throw new Error(
        `run:script: '${params.command}' failed (${reason}): ${stderrHead || '<no stderr>'}`,
      );
    }

    context.logger.info(`run:script: command '${params.command}' completed in ${durationMs}ms`);

    return {
      output: {
        command: params.command,
        args: params.args,
        exitCode,
        stdout: truncateOutput(stdout, MAX_OUTPUT_BYTES),
        stderr: truncateOutput(stderr, MAX_OUTPUT_BYTES),
        durationMs,
        cwd,
      },
    };
  },
};
