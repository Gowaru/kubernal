import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import Handlebars from 'handlebars';
import { db } from '../../../shared/database.js';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const execFileAsync = promisify(execFile);

const META_KEYS = new Set(['skeleton', 'subdir', 'gitInit', 'branch', 'force']);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.zip',
  '.gz',
  '.tar',
  '.bz2',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.keystore',
  '.jks',
  '.p12',
  '.pfx',
  '.ico',
  '.cur',
]);

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  if (!existsSync(filePath)) return false;
  try {
    const buffer = readFileSync(filePath);
    const sample = buffer.subarray(0, 4096);
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

interface ScaffoldParams {
  skeleton: string;
  subdir: string;
  gitInit: boolean;
  branch: string;
  force: boolean;
  variables: Record<string, unknown>;
}

function parseScaffoldParams(raw: Record<string, unknown>): ScaffoldParams {
  const skeleton =
    typeof raw['skeleton'] === 'string' && raw['skeleton'].length > 0 ? raw['skeleton'] : '';
  const subdir = typeof raw['subdir'] === 'string' ? raw['subdir'] : '';
  const gitInit = raw['gitInit'] === true;
  const branch = typeof raw['branch'] === 'string' ? raw['branch'] : 'main';
  const force = raw['force'] === true;
  const variables: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!META_KEYS.has(k)) {
      variables[k] = v;
    }
  }
  return { skeleton, subdir, gitInit, branch, force, variables };
}

async function cloneRepo(
  url: string,
  dest: string,
  logger: ActionContext['logger'],
): Promise<void> {
  logger.info(`Cloning ${url} into ${dest}`);
  await execFileAsync('git', ['clone', '--depth', '1', url, dest], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  });
  const gitDir = path.join(dest, '.git');
  if (existsSync(gitDir)) {
    await rm(gitDir, { recursive: true, force: true });
  }
}

async function gitInitAndPush(
  repoDir: string,
  remoteUrl: string,
  branch: string,
  appName: string,
  logger: ActionContext['logger'],
): Promise<void> {
  const isRepo = existsSync(path.join(repoDir, '.git'));
  if (!isRepo) {
    await execFileAsync('git', ['init', '-b', branch], { cwd: repoDir, timeout: 30_000 });
    logger.info(`git init (branch=${branch})`);
  }
  await execFileAsync('git', ['add', '-A'], { cwd: repoDir, timeout: 30_000 });
  try {
    await execFileAsync(
      'git',
      ['commit', '-m', `Add Kubernal platform scaffolding for ${appName}`],
      {
        cwd: repoDir,
        timeout: 30_000,
      },
    );
    logger.info('git commit');
  } catch {
    logger.info('Nothing to commit');
  }
  const remotes = await execFileAsync('git', ['remote'], { cwd: repoDir, timeout: 10_000 });
  if (!remotes.stdout.trim()) {
    const sshUrl = remoteUrl.replace(/^https:\/\/github\.com\//, 'git@github.com:');
    await execFileAsync('git', ['remote', 'add', 'origin', sshUrl], {
      cwd: repoDir,
      timeout: 10_000,
    });
    logger.info(`git remote add origin ${sshUrl}`);
  }
  try {
    await execFileAsync('git', ['push', '-u', 'origin', branch], {
      cwd: repoDir,
      timeout: 120_000,
    });
    logger.info(`git push to origin/${branch}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`git push failed (non-blocking): ${message}`);
  }
}

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await walkDir(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

function renameFile(filePath: string, variables: Record<string, unknown>): string {
  const dir = path.dirname(filePath);
  let base = path.basename(filePath);
  for (const [key, val] of Object.entries(variables)) {
    const raw = String(val ?? '');
    const pattern = `__${key}__`;
    if (base.includes(pattern)) {
      base = base.replaceAll(pattern, raw);
    }
    const pascalKey = `__${key.charAt(0).toUpperCase() + key.slice(1)}__`;
    if (base.includes(pascalKey)) {
      const pascalVal = raw
        .split(/[-_]/)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');
      base = base.replaceAll(pascalKey, pascalVal);
    }
    const upperKey = `__${key.toUpperCase()}__`;
    if (base.includes(upperKey)) {
      base = base.replaceAll(upperKey, raw.toUpperCase().replace(/[-]/g, '_'));
    }
  }
  return path.join(dir, base);
}

export const scaffoldProjectAction: PipelineAction = {
  name: 'scaffold:project',
  validate(params) {
    parseScaffoldParams(params);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const params = parseScaffoldParams(context.stepParams);
    const { skeleton, subdir, gitInit, branch, force } = params;
    const variables: Record<string, unknown> = { ...(params.variables ?? {}) };

    context.logger.info(`scaffold:project started (appId=${context.applicationId})`);

    const application = await db.application.findUnique({
      where: { id: context.applicationId },
      select: { name: true, repositoryUrl: true, config: true, templateId: true },
    });
    if (!application) throw new Error(`Application ${context.applicationId} not found`);

    const appConfig = (application.config as Record<string, unknown>) ?? {};
    const scaffoldKey = `scaffolded:${application.templateId}`;
    const alreadyScaffolded = appConfig[scaffoldKey] === true;

    const allVariables: Record<string, unknown> = {
      name: application.name,
      ...variables,
    };

    const workspaceRepo = path.join(context.workspaceDir, 'repo');
    const skeletonDir = path.join(context.workspaceDir, 'skeleton');

    await mkdir(workspaceRepo, { recursive: true });
    await mkdir(skeletonDir, { recursive: true });

    if (application.repositoryUrl && application.repositoryUrl.length > 0) {
      try {
        await cloneRepo(application.repositoryUrl, workspaceRepo, context.logger);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        context.logger.warn(`Failed to clone user repo (${message}), using empty workspace`);
        await mkdir(workspaceRepo, { recursive: true });
      }
    }

    if (alreadyScaffolded && !force) {
      context.logger.info(
        `Scaffolding already completed for template ${application.templateId}, skipping`,
      );
      return {
        output: {
          skipped: true,
          path: workspaceRepo,
          reason: 'already_scaffolded',
        },
      };
    }

    let skeletonUrl = skeleton;
    if (!skeletonUrl) {
      const template = await db.goldenPathTemplate.findUnique({
        where: { id: application.templateId },
        select: { repository: true },
      });
      if (!template?.repository) {
        throw new Error(
          'scaffold:project: no skeleton URL provided and template has no repository',
        );
      }
      skeletonUrl = template.repository;
    }
    await cloneRepo(skeletonUrl, skeletonDir, context.logger);

    let skeletonRoot = skeletonDir;
    if (subdir) {
      const subPath = path.join(skeletonDir, subdir);
      if (existsSync(subPath) && statSync(subPath).isDirectory()) {
        skeletonRoot = subPath;
      } else {
        context.logger.warn(`Skeleton subdir '${subdir}' not found, using root`);
      }
    }

    const skeletonFiles = await walkDir(skeletonRoot);
    let filesCreated = 0;
    let filesSkipped = 0;

    for (const srcPath of skeletonFiles) {
      const relativePath = path.relative(skeletonRoot, srcPath);
      const destPath = path.join(workspaceRepo, relativePath);
      const destDir = path.dirname(destPath);

      await mkdir(destDir, { recursive: true });

      if (existsSync(destPath)) {
        filesSkipped++;
        continue;
      }

      const renamedPath = renameFile(destPath, allVariables);
      const renamedDir = path.dirname(renamedPath);
      await mkdir(renamedDir, { recursive: true });

      if (isBinaryFile(srcPath)) {
        await cp(srcPath, renamedPath);
        filesCreated++;
        continue;
      }

      let content: string;
      try {
        content = await readFile(srcPath, 'utf-8');
      } catch {
        await cp(srcPath, renamedPath);
        filesCreated++;
        continue;
      }

      try {
        const template = Handlebars.compile(content, { noEscape: true });
        const rendered = template(allVariables);
        await writeFile(renamedPath, rendered, 'utf-8');
        filesCreated++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        context.logger.warn(`Handlebars failed for ${relativePath}: ${message}, copying raw`);
        await cp(srcPath, renamedPath);
        filesCreated++;
      }
    }

    context.logger.info(`Scaffolded ${filesCreated} files (${filesSkipped} skipped)`);

    let gitPushed = false;
    if (gitInit && application.repositoryUrl) {
      try {
        await gitInitAndPush(
          workspaceRepo,
          application.repositoryUrl,
          branch,
          application.name,
          context.logger,
        );
        gitPushed = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        context.logger.warn(`git init/push failed: ${message}`);
      }
    }

    const updateConfig: Record<string, unknown> = {
      ...appConfig,
      [scaffoldKey]: true,
      scaffoldedAt: new Date().toISOString(),
    };

    await db.application.update({
      where: { id: context.applicationId },
      data: { config: updateConfig as Record<string, never> },
    });

    await rm(skeletonDir, { recursive: true, force: true });

    context.logger.info('scaffold:project completed successfully');

    return {
      output: {
        skipped: false,
        path: workspaceRepo,
        filesCreated,
        filesSkipped,
        gitPushed,
        gitUrl: application.repositoryUrl,
        variables: allVariables,
      },
    };
  },
};
