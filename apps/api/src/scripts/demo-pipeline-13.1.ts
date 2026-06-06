import { existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { db } from '../shared/database.js';
import { logger } from '../shared/logger.js';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const REPO_URL = 'https://github.com/octocat/Hello-World';
const DEMO_TAG = `pipeline13.1-${Date.now()}`;

interface DemoStep {
  name: string;
  status: 'ok' | 'skipped' | 'failed' | 'pending';
  message: string;
  durationMs: number;
}

function printHeader(title: string): void {
  process.stdout.write('\n');
  process.stdout.write('━'.repeat(78) + '\n');
  process.stdout.write(`  ${title}\n`);
  process.stdout.write('━'.repeat(78) + '\n');
}

function fmtStepResult(step: DemoStep): string {
  const icon =
    step.status === 'ok' ? '✓' : step.status === 'skipped' ? '⊘' : step.status === 'failed' ? '✗' : '…';
  return `  ${icon} ${step.name.padEnd(45)} ${step.status.toUpperCase().padEnd(8)} (${step.durationMs}ms)`;
}

function runStep<T>(name: string, fn: () => T | Promise<T>): Promise<{ step: DemoStep; value?: T; error?: unknown }> {
  const start = Date.now();
  return Promise.resolve()
    .then(() => fn())
    .then((value) => ({
      step: { name, status: 'ok' as const, message: 'OK', durationMs: Date.now() - start },
      value,
    }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return {
        step: { name, status: 'failed' as const, message, durationMs: Date.now() - start },
        error,
      };
    });
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

interface DataEnvelope<T> {
  data: T;
  total?: number;
}

interface Template {
  id: string;
  name: string;
}

interface Application {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  type: string;
  namespace: string;
}

interface Deployment {
  id: string;
}

interface Pipeline {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  steps?: PipelineStep[];
}

interface PipelineStep {
  id: string;
  name: string;
  order: number;
  action: string;
  status: string;
  output: unknown;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

async function findOrCreateTeam(): Promise<{ id: string }> {
  const existing = await db.team.findUnique({ where: { name: 'pipeline-demo-team' } });
  if (existing) return existing;
  return db.team.create({
    data: {
      name: 'pipeline-demo-team',
      description: 'Team created by Phase 13.1 demo',
      namespacePrefix: 'pipeline-demo',
    },
  });
}

async function findOrCreateUser(teamId: string): Promise<{ id: string; email: string }> {
  const email = 'pipeline-demo@kubernal.io';
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({
    data: { email, name: 'Pipeline Demo User', role: 'platform_engineer', teamId },
  });
}

async function findOrCreateTemplate(): Promise<Template> {
  const name = `pipeline-demo-${DEMO_TAG}`;
  const existing = await db.goldenPathTemplate.findUnique({ where: { name } });
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  return api<{ data: Template }>('POST', '/api/v1/templates', {
    name,
    version: '1.0.0',
    category: 'backend',
    description: 'Phase 13.1 pipeline demo template (single fetch:template step)',
    repository: REPO_URL,
    parameters: {},
    steps: [
      {
        id: 'clone',
        name: 'Clone template repository',
        action: 'fetch:template',
        input: { repository: REPO_URL },
      },
    ],
  }).then((res) => res.data);
}

async function findOrCreateApplication(args: {
  teamId: string;
  ownerId: string;
  templateId: string;
}): Promise<Application> {
  const name = `pipeline-demo-app-${DEMO_TAG}`;
  const existing = await db.application.findFirst({ where: { name } });
  if (existing) return { id: existing.id, name: existing.name };
  return api<{ data: Application }>('POST', '/api/v1/applications', {
    name,
    description: 'Phase 13.1 pipeline demo application',
    templateId: args.templateId,
    teamId: args.teamId,
    ownerId: args.ownerId,
    repositoryUrl: REPO_URL,
  }).then((res) => res.data);
}

async function findOrCreateEnvironment(args: {
  applicationId: string;
  teamId: string;
}): Promise<Environment> {
  const name = `pipeline-demo-app-${DEMO_TAG}-dev`;
  const existing = await db.environment.findFirst({ where: { name } });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      type: existing.type,
      namespace: existing.namespace,
    };
  }
  return api<{ data: Environment }>('POST', '/api/v1/environments', {
    name,
    type: 'dev',
    applicationId: args.applicationId,
    namespace: `pipeline-demo-${DEMO_TAG}-dev`.slice(0, 63),
    clusterName: 'kubernal',
    requiresApproval: false,
  }).then((res) => res.data);
}

async function findOrCreateDeployment(args: {
  applicationId: string;
  environmentId: string;
}): Promise<Deployment> {
  const commitSha = 'demo13.1a1b2';
  const existing = await db.deployment.findFirst({
    where: { applicationId: args.applicationId, commitSha },
  });
  if (existing) return { id: existing.id };
  return api<{ data: Deployment }>('POST', '/api/v1/deployments', {
    applicationId: args.applicationId,
    environmentId: args.environmentId,
    version: '0.0.1-demo',
    commitSha,
    trigger: 'manual',
  }).then((res) => res.data);
}

function truncateOutput(value: unknown, max = 200): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + '…' : text;
}

async function main(): Promise<void> {
  const start = Date.now();
  const steps: DemoStep[] = [];
  const createdIds: { applicationId?: string; environmentId?: string; templateId?: string } = {};

  printHeader('Phase 13.1 — Pipeline orchestration end-to-end demo');

  process.stdout.write('\n  Checking API health...\n');
  const healthStep = await runStep('1.1 GET /api/v1/health', async () => {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = (await res.json()) as { status: string };
    if (json.status !== 'ok') throw new Error(`API status: ${json.status}`);
    return json.status;
  });
  steps.push(healthStep.step);
  if (healthStep.error) {
    process.stderr.write(`\nFatal: API is not reachable at ${API_BASE}\n\n`);
    process.exit(1);
  }

  process.stdout.write('\n  Setting up demo entities...\n');
  const setupStep = await runStep('2.1 create user + team + template + app + env + deployment', async () => {
    const team = await findOrCreateTeam();
    const user = await findOrCreateUser(team.id);
    const template = await findOrCreateTemplate();
    createdIds.templateId = template.id;
    const app = await findOrCreateApplication({
      teamId: team.id,
      ownerId: user.id,
      templateId: template.id,
    });
    createdIds.applicationId = app.id;
    const env = await findOrCreateEnvironment({ applicationId: app.id, teamId: team.id });
    createdIds.environmentId = env.id;
    const deployment = await findOrCreateDeployment({
      applicationId: app.id,
      environmentId: env.id,
    });
    return {
      teamId: team.id,
      userId: user.id,
      templateId: template.id,
      appId: app.id,
      envId: env.id,
      deploymentId: deployment.id,
      appName: app.name,
      templateName: template.name,
    };
  });
  steps.push(setupStep.step);
  if (setupStep.error || !setupStep.value) {
    process.stderr.write(`\nFatal: setup failed\n\n`);
    process.exit(1);
  }
  const ids = setupStep.value;

  process.stdout.write('\n  Listing available pipeline actions...\n');
  const actionsStep = await runStep('3.1 GET /api/v1/pipelines/actions', async () => {
    const res = await api<DataEnvelope<string[]>>('GET', '/api/v1/pipelines/actions');
    process.stdout.write(`     ${res.data.length} actions: ${res.data.join(', ')}\n`);
    return res.data;
  });
  steps.push(actionsStep.step);

  process.stdout.write('\n  Executing pipeline from template...\n');
  const executeStep = await runStep('4.1 POST /api/v1/pipelines/execute', async () => {
    const res = await api<DataEnvelope<Pipeline>>('POST', '/api/v1/pipelines/execute', {
      deploymentId: ids.deploymentId,
      templateId: ids.templateId,
      params: {},
    });
    process.stdout.write(`     pipeline.id = ${res.data.id}\n`);
    process.stdout.write(`     pipeline.status = ${res.data.status}\n`);
    process.stdout.write(`     steps: ${res.data.steps?.length ?? 0}\n`);
    return res.data;
  });
  steps.push(executeStep.step);
  if (executeStep.error || !executeStep.value) {
    process.stderr.write(`\nFatal: pipeline execution request failed\n\n`);
    process.exit(1);
  }
  const pipeline = executeStep.value;
  const pipelineStart = Date.now();

  process.stdout.write('\n  Waiting for worker to pick up and execute pipeline...\n');
  const pollStep = await runStep(`5.1 poll pipeline status (max 30s)`, async () => {
    for (let i = 0; i < 30; i += 1) {
      const res = await api<DataEnvelope<Pipeline>>('GET', `/api/v1/pipelines/${pipeline.id}`);
      const status = res.data.status;
      process.stdout.write(`     [${i + 1}s] status=${status}\n`);
      if (status === 'success' || status === 'failed' || status === 'cancelled') {
        return res.data;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Pipeline did not complete within 30s');
  });
  steps.push(pollStep.step);
  if (pollStep.error || !pollStep.value) {
    process.stderr.write(`\nFatal: pipeline did not complete\n\n`);
    process.exit(1);
  }
  const finalPipeline = pollStep.value;
  const pipelineDuration = Date.now() - pipelineStart;

  process.stdout.write('\n  Fetching pipeline steps...\n');
  const stepsList = await runStep('6.1 GET /api/v1/pipelines/:id/steps', async () => {
    const res = await api<DataEnvelope<PipelineStep[]>>(
      'GET',
      `/api/v1/pipelines/${pipeline.id}/steps`,
    );
    return res.data;
  });
  steps.push(stepsList.step);
  const pipelineSteps = stepsList.value ?? [];

  let clonedPath: string | null = null;
  for (const step of pipelineSteps) {
    const stepStart = step.startedAt ? new Date(step.startedAt).getTime() : null;
    const stepEnd = step.completedAt ? new Date(step.completedAt).getTime() : null;
    const stepDuration = stepStart && stepEnd ? stepEnd - stepStart : 0;
    process.stdout.write(`\n  ┌─ Step ${step.order}: ${step.name}\n`);
    process.stdout.write(`  │ id:        ${step.id}\n`);
    process.stdout.write(`  │ action:    ${step.action}\n`);
    process.stdout.write(`  │ status:    ${step.status}\n`);
    process.stdout.write(`  │ duration:  ${stepDuration}ms\n`);
    if (step.errorMessage) {
      process.stdout.write(`  │ error:     ${step.errorMessage.slice(0, 200)}\n`);
    }
    const output = truncateOutput(step.output, 300);
    if (output) {
      process.stdout.write(`  │ output:    ${output}\n`);
    }
    process.stdout.write(`  └─\n`);
    if (step.action === 'fetch:template' && step.status === 'success') {
      const out = step.output as { path?: string } | null;
      if (out?.path) clonedPath = out.path;
    }
  }

  if (clonedPath) {
    process.stdout.write('\n  Verifying cloned repository on disk...\n');
    const verifyStep = await runStep(`7.1 stat ${clonedPath}`, async () => {
      if (!existsSync(clonedPath)) throw new Error(`Path does not exist: ${clonedPath}`);
      const stat = statSync(clonedPath);
      const isDir = stat.isDirectory();
      const readmePath = `${clonedPath}/README.md`;
      const readmeExists = existsSync(readmePath);
      process.stdout.write(`     exists:    yes (${isDir ? 'directory' : 'file'})\n`);
      process.stdout.write(`     README.md: ${readmeExists ? 'present' : 'missing'}\n`);
      if (readmeExists) {
        const { readFileSync } = await import('node:fs');
        const head = readFileSync(readmePath, 'utf8').split('\n').slice(0, 5).join('\n');
        process.stdout.write(`     README first lines:\n`);
        for (const line of head.split('\n')) {
          process.stdout.write(`       ${line}\n`);
        }
      }
      return { isDir, readmeExists };
    });
    steps.push(verifyStep.step);

    process.stdout.write('\n  Cleaning up cloned repository...\n');
    const cleanupStep = await runStep(`8.1 rm -rf ${clonedPath}`, async () => {
      await rm(clonedPath, { recursive: true, force: true });
      process.stdout.write(`     removed ${clonedPath}\n`);
    });
    steps.push(cleanupStep.step);
  }

  printHeader('Summary');
  for (const step of steps) {
    process.stdout.write(fmtStepResult(step) + '\n');
  }
  process.stdout.write(`\n  Pipeline status:    ${finalPipeline.status}\n`);
  process.stdout.write(`  Pipeline duration:  ${pipelineDuration}ms\n`);
  process.stdout.write(`  Steps executed:     ${pipelineSteps.length}\n`);
  if (clonedPath) {
    process.stdout.write(`  Cloned path:        ${clonedPath}\n`);
  }
  process.stdout.write(`  Total duration:     ${Date.now() - start}ms\n`);
  process.stdout.write('\n' + '━'.repeat(78) + '\n\n');

  logger.info(
    {
      pipelineId: pipeline.id,
      finalStatus: finalPipeline.status,
      durationMs: pipelineDuration,
      stepCount: pipelineSteps.length,
    },
    'Phase 13.1 pipeline demo complete',
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nFatal error: ${message}\n`);
  if (error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(1);
});
