import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { db } from '../shared/database.js';
import { logger } from '../shared/logger.js';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const REPO_URL = 'https://github.com/octocat/Hello-World';
const TEAM_NAME = 'pipeline-demo-team';
const USER_EMAIL = 'pipeline-demo@kubernal.io';
const KUBECTL_BIN = 'kubectl';

const execFileAsync = promisify(execFile);

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

interface TemplateStepInput {
  id: string;
  name: string;
  action: string;
  input: Record<string, unknown>;
}

async function findOrCreateTeam(): Promise<{ id: string }> {
  const existing = await db.team.findUnique({ where: { name: TEAM_NAME } });
  if (existing) return existing;
  return db.team.create({
    data: {
      name: TEAM_NAME,
      description: 'Team created by Phase 13 pipeline demos',
      namespacePrefix: 'pipeline-demo',
    },
  });
}

async function findOrCreateUser(teamId: string): Promise<{ id: string; email: string }> {
  const existing = await db.user.findUnique({ where: { email: USER_EMAIL } });
  if (existing) return existing;
  return db.user.create({
    data: { email: USER_EMAIL, name: 'Pipeline Demo User', role: 'platform_engineer', teamId },
  });
}

async function findOrCreateTemplate(args: {
  name: string;
  description: string;
  steps: TemplateStepInput[];
}): Promise<Template> {
  const existing = await db.goldenPathTemplate.findUnique({ where: { name: args.name } });
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  return api<{ data: Template }>('POST', '/api/v1/templates', {
    name: args.name,
    version: '1.0.0',
    category: 'backend',
    description: args.description,
    repository: REPO_URL,
    parameters: {},
    steps: args.steps,
  }).then((res) => res.data);
}

async function findOrCreateApplication(args: {
  name: string;
  description: string;
  teamId: string;
  ownerId: string;
  templateId: string;
}): Promise<Application> {
  const existing = await db.application.findFirst({ where: { name: args.name } });
  if (existing) return { id: existing.id, name: existing.name };
  return api<{ data: Application }>('POST', '/api/v1/applications', {
    name: args.name,
    description: args.description,
    templateId: args.templateId,
    teamId: args.teamId,
    ownerId: args.ownerId,
    repositoryUrl: REPO_URL,
  }).then((res) => res.data);
}

async function findOrCreateEnvironment(args: {
  name: string;
  applicationId: string;
  namespace: string;
}): Promise<Environment> {
  const existing = await db.environment.findFirst({ where: { name: args.name } });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      type: existing.type,
      namespace: existing.namespace,
    };
  }
  return api<{ data: Environment }>('POST', '/api/v1/environments', {
    name: args.name,
    type: 'dev',
    applicationId: args.applicationId,
    namespace: args.namespace.slice(0, 63),
    clusterName: 'kubernal',
    requiresApproval: false,
  }).then((res) => res.data);
}

async function findOrCreateDeployment(args: {
  applicationId: string;
  environmentId: string;
  commitSha: string;
}): Promise<Deployment> {
  const existing = await db.deployment.findFirst({
    where: { applicationId: args.applicationId, commitSha: args.commitSha },
  });
  if (existing) return { id: existing.id };
  return api<{ data: Deployment }>('POST', '/api/v1/deployments', {
    applicationId: args.applicationId,
    environmentId: args.environmentId,
    version: '0.0.1-demo',
    commitSha: args.commitSha,
    trigger: 'manual',
  }).then((res) => res.data);
}

function truncateOutput(value: unknown, max = 200): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + '…' : text;
}

async function pollPipelineCompletion(pipelineId: string, maxSeconds: number): Promise<Pipeline> {
  for (let i = 0; i < maxSeconds; i += 1) {
    const res = await api<DataEnvelope<Pipeline>>('GET', `/api/v1/pipelines/${pipelineId}`);
    const status = res.data.status;
    process.stdout.write(`     [${i + 1}s] status=${status}\n`);
    if (status === 'success' || status === 'failed' || status === 'cancelled') {
      return res.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Pipeline did not complete within ${maxSeconds}s`);
}

function printPipelineSteps(pipelineSteps: PipelineStep[]): { clonedPath: string | null } {
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
  return { clonedPath };
}

async function runPhase131Demo(): Promise<void> {
  const demoTag = `pipeline13.1-${Date.now()}`;
  const start = Date.now();
  const steps: DemoStep[] = [];

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
    const template = await findOrCreateTemplate({
      name: `pipeline-demo-${demoTag}`,
      description: 'Phase 13.1 pipeline demo template (single fetch:template step)',
      steps: [
        {
          id: 'clone',
          name: 'Clone template repository',
          action: 'fetch:template',
          input: { repository: REPO_URL },
        },
      ],
    });
    const app = await findOrCreateApplication({
      name: `pipeline-demo-app-${demoTag}`,
      description: 'Phase 13.1 pipeline demo application',
      teamId: team.id,
      ownerId: user.id,
      templateId: template.id,
    });
    const env = await findOrCreateEnvironment({
      name: `pipeline-demo-app-${demoTag}-dev`,
      applicationId: app.id,
      namespace: `pipeline-demo-${demoTag}-dev`.slice(0, 63),
    });
    const deployment = await findOrCreateDeployment({
      applicationId: app.id,
      environmentId: env.id,
      commitSha: 'demo13.1a1b2',
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
  const pollStep = await runStep('5.1 poll pipeline status (max 30s)', async () => {
    return pollPipelineCompletion(pipeline.id, 30);
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

  const { clonedPath } = printPipelineSteps(pipelineSteps);

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

  printHeader('Summary (Phase 13.1)');
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

async function runPhase132Demo(): Promise<void> {
  const demoTag = `pipeline13.2-${Date.now()}`;
  const appName = 'demo-13-2-app';
  const teamNamespacePrefix = 'kubernal-demo';
  const environmentType = 'dev' as const;
  const expectedNamespace = `${teamNamespacePrefix}-${appName}-${environmentType}`;

  const start = Date.now();
  const steps: DemoStep[] = [];

  printHeader('Phase 13.2 — provision:infrastructure + run:script (3-step pipeline)');

  process.stdout.write('\n  Reusing team + user from Phase 13.1...\n');
  const setupStep = await runStep('2.1 create template + app + env + deployment', async () => {
    const team = await findOrCreateTeam();
    const user = await findOrCreateUser(team.id);
    const template = await findOrCreateTemplate({
      name: `pipeline-demo-13-2-${demoTag}`,
      description: 'Phase 13.2 pipeline demo template (3 steps: fetch + run + provision)',
      steps: [
        {
          id: 'clone',
          name: 'Clone template repository',
          action: 'fetch:template',
          input: { repository: REPO_URL },
        },
        {
          id: 'list-files',
          name: 'List cloned repository contents',
          action: 'run:script',
          input: { command: 'ls', args: ['-la'] },
        },
        {
          id: 'provision-ns',
          name: 'Provision K8s namespace + RBAC',
          action: 'provision:infrastructure',
          input: {
            applicationName: appName,
            environmentType,
            teamNamespacePrefix,
            createRbac: true,
          },
        },
      ],
    });
    const app = await findOrCreateApplication({
      name: `phase-13-2-demo-app-${demoTag}`,
      description: 'Phase 13.2 pipeline demo application',
      teamId: team.id,
      ownerId: user.id,
      templateId: template.id,
    });
    const env = await findOrCreateEnvironment({
      name: `phase-13-2-demo-app-${demoTag}-dev`,
      applicationId: app.id,
      namespace: expectedNamespace.slice(0, 63),
    });
    const deployment = await findOrCreateDeployment({
      applicationId: app.id,
      environmentId: env.id,
      commitSha: 'demo13.2a1b2',
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

  process.stdout.write('\n  Executing 3-step pipeline from template...\n');
  const executeStep = await runStep('3.1 POST /api/v1/pipelines/execute', async () => {
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

  process.stdout.write('\n  Waiting for worker to pick up and execute pipeline (max 60s)...\n');
  const pollStep = await runStep('4.1 poll pipeline status (max 60s)', async () => {
    return pollPipelineCompletion(pipeline.id, 60);
  });
  steps.push(pollStep.step);
  if (pollStep.error || !pollStep.value) {
    process.stderr.write(`\nFatal: pipeline did not complete\n\n`);
    process.exit(1);
  }
  const finalPipeline = pollStep.value;
  const pipelineDuration = Date.now() - pipelineStart;

  process.stdout.write('\n  Fetching pipeline steps...\n');
  const stepsList = await runStep('5.1 GET /api/v1/pipelines/:id/steps', async () => {
    const res = await api<DataEnvelope<PipelineStep[]>>(
      'GET',
      `/api/v1/pipelines/${pipeline.id}/steps`,
    );
    return res.data;
  });
  steps.push(stepsList.step);
  const pipelineSteps = stepsList.value ?? [];

  const { clonedPath } = printPipelineSteps(pipelineSteps);

  process.stdout.write('\n  Verifying K8s namespace exists...\n');
  const verifyNsStep = await runStep(
    `6.1 kubectl get namespace ${expectedNamespace}`,
    async () => {
      const result = await execFileAsync(KUBECTL_BIN, [
        'get',
        'namespace',
        expectedNamespace,
        '-o',
        'jsonpath={.metadata.name}',
      ]);
      const actual = result.stdout.trim();
      if (actual !== expectedNamespace) {
        throw new Error(`expected namespace '${expectedNamespace}', got '${actual}'`);
      }
      process.stdout.write(`     namespace verified: ${actual}\n`);
      return actual;
    },
  );
  steps.push(verifyNsStep.step);

  let verifiedReadme = false;
  if (clonedPath) {
    process.stdout.write('\n  Verifying cloned repository on disk...\n');
    const verifyCloneStep = await runStep(`7.1 stat ${clonedPath}`, async () => {
      if (!existsSync(clonedPath)) throw new Error(`Path does not exist: ${clonedPath}`);
      const stat = statSync(clonedPath);
      const isDir = stat.isDirectory();
      const readmePath = `${clonedPath}/README.md`;
      const readmeExists = existsSync(readmePath);
      process.stdout.write(`     exists:    yes (${isDir ? 'directory' : 'file'})\n`);
      process.stdout.write(`     README.md: ${readmeExists ? 'present' : 'missing'}\n`);
      verifiedReadme = readmeExists;
      return { isDir, readmeExists };
    });
    steps.push(verifyCloneStep.step);
  }

  process.stdout.write('\n  Cleaning up K8s namespace + cloned repository...\n');
  const cleanupNsStep = await runStep(
    `8.1 kubectl delete namespace ${expectedNamespace}`,
    async () => {
      try {
        await execFileAsync(KUBECTL_BIN, [
          'delete',
          'namespace',
          expectedNamespace,
          '--ignore-not-found=true',
          '--wait=false',
        ]);
        process.stdout.write(`     namespace '${expectedNamespace}' delete requested\n`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        process.stdout.write(`     WARN: kubectl delete failed: ${message}\n`);
      }
    },
  );
  steps.push(cleanupNsStep.step);

  if (clonedPath) {
    const cleanupCloneStep = await runStep(`8.2 rm -rf ${clonedPath}`, async () => {
      await rm(clonedPath, { recursive: true, force: true });
      process.stdout.write(`     removed ${clonedPath}\n`);
    });
    steps.push(cleanupCloneStep.step);
  }

  printHeader('Summary (Phase 13.2)');
  for (const step of steps) {
    process.stdout.write(fmtStepResult(step) + '\n');
  }
  process.stdout.write(`\n  Pipeline status:    ${finalPipeline.status}\n`);
  process.stdout.write(`  Pipeline duration:  ${pipelineDuration}ms\n`);
  process.stdout.write(`  Steps executed:     ${pipelineSteps.length}\n`);
  process.stdout.write(`  Namespace verified: ${verifyNsStep.value ?? expectedNamespace}\n`);
  process.stdout.write(`  Cloned path:        ${clonedPath ?? 'n/a'}\n`);
  process.stdout.write(`  README verified:    ${verifiedReadme}\n`);
  process.stdout.write(`  Total duration:     ${Date.now() - start}ms\n`);
  process.stdout.write('\n' + '━'.repeat(78) + '\n\n');

  logger.info(
    {
      pipelineId: pipeline.id,
      finalStatus: finalPipeline.status,
      durationMs: pipelineDuration,
      stepCount: pipelineSteps.length,
      namespace: expectedNamespace,
    },
    'Phase 13.2 pipeline demo complete',
  );
}

async function runPhase133Demo(): Promise<void> {
  const demoTag = `pipeline13.3-${Date.now()}`;
  const imageTag = 'kubernal-sample:13.3-demo';
  const sampleAppDir = path.resolve(process.cwd(), 'test-fixtures', 'sample-app');
  const dockerfilePath = path.join(sampleAppDir, 'Dockerfile');

  const start = Date.now();
  const steps: DemoStep[] = [];

  printHeader('Phase 13.3 — build:image (1-step pipeline building a sample image)');

  process.stdout.write('\n  Verifying local sample-app fixture on disk...\n');
  const fixtureStep = await runStep(
    '1.1 stat sample-app/Dockerfile',
    async () => {
      if (!existsSync(sampleAppDir)) {
        throw new Error(`sample-app directory not found at ${sampleAppDir}`);
      }
      if (!existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile not found at ${dockerfilePath}`);
      }
      const { readFileSync } = await import('node:fs');
      const dockerfile = readFileSync(dockerfilePath, 'utf8');
      process.stdout.write(`     context:    ${sampleAppDir}\n`);
      process.stdout.write(`     dockerfile: ${dockerfilePath}\n`);
      process.stdout.write(`     content:\n`);
      for (const line of dockerfile.split('\n')) {
        process.stdout.write(`       ${line}\n`);
      }
      return { sampleAppDir, dockerfilePath };
    },
  );
  steps.push(fixtureStep.step);
  if (fixtureStep.error) {
    process.stderr.write(`\nFatal: sample-app fixture missing\n\n`);
    process.exit(1);
  }

  process.stdout.write('\n  Reusing team + user from Phase 13.1...\n');
  const setupStep = await runStep('2.1 create template + app + env + deployment', async () => {
    const team = await findOrCreateTeam();
    const user = await findOrCreateUser(team.id);
    const template = await findOrCreateTemplate({
      name: `pipeline-demo-13-3-${demoTag}`,
      description: 'Phase 13.3 pipeline demo template (1 step: build:image)',
      steps: [
        {
          id: 'build-sample',
          name: 'Build kubernal-sample image from local Dockerfile',
          action: 'build:image',
          input: {
            context: sampleAppDir,
            dockerfile: 'Dockerfile',
            image: imageTag,
            labels: {
              'kubernal.io/build': 'demo',
              'kubernal.io/phase': '13.3',
            },
          },
        },
      ],
    });
    const app = await findOrCreateApplication({
      name: `phase-13-3-demo-app-${demoTag}`,
      description: 'Phase 13.3 pipeline demo application',
      teamId: team.id,
      ownerId: user.id,
      templateId: template.id,
    });
    const env = await findOrCreateEnvironment({
      name: `phase-13-3-demo-app-${demoTag}-dev`,
      applicationId: app.id,
      namespace: `kubernal-demo-13-3-${demoTag}-dev`.slice(0, 63),
    });
    const deployment = await findOrCreateDeployment({
      applicationId: app.id,
      environmentId: env.id,
      commitSha: 'demo13.3a1b2',
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

  process.stdout.write('\n  Executing 1-step build:image pipeline...\n');
  const executeStep = await runStep('3.1 POST /api/v1/pipelines/execute', async () => {
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

  process.stdout.write('\n  Waiting for worker to build image (max 90s, docker pull may take time)...\n');
  const pollStep = await runStep('4.1 poll pipeline status (max 90s)', async () => {
    return pollPipelineCompletion(pipeline.id, 90);
  });
  steps.push(pollStep.step);
  if (pollStep.error || !pollStep.value) {
    process.stderr.write(`\nFatal: pipeline did not complete\n\n`);
    process.exit(1);
  }
  const finalPipeline = pollStep.value;
  const pipelineDuration = Date.now() - pipelineStart;

  process.stdout.write('\n  Fetching pipeline steps...\n');
  const stepsList = await runStep('5.1 GET /api/v1/pipelines/:id/steps', async () => {
    const res = await api<DataEnvelope<PipelineStep[]>>(
      'GET',
      `/api/v1/pipelines/${pipeline.id}/steps`,
    );
    return res.data;
  });
  steps.push(stepsList.step);
  const pipelineSteps = stepsList.value ?? [];

  printPipelineSteps(pipelineSteps);

  const buildStep = pipelineSteps.find((s) => s.action === 'build:image');
  const buildOutput =
    buildStep && typeof buildStep.output === 'object' && buildStep.output !== null
      ? (buildStep.output as Record<string, unknown>)
      : null;
  const builtImage = typeof buildOutput?.['image'] === 'string' ? (buildOutput['image'] as string) : null;
  const builtImageId = typeof buildOutput?.['imageId'] === 'string' ? (buildOutput['imageId'] as string) : null;

  process.stdout.write('\n  Verifying built image via docker run...\n');
  const runStepResult = await runStep('6.1 docker run --rm kubernal-sample:13.3-demo cat /hello.txt', async () => {
    const result = await execFileAsync('docker', [
      'run',
      '--rm',
      imageTag,
      'cat',
      '/hello.txt',
    ]);
    const output = result.stdout.trim();
    process.stdout.write(`     stdout: ${output}\n`);
    if (output !== 'hello') {
      throw new Error(`expected 'hello', got '${output}'`);
    }
    return output;
  });
  steps.push(runStepResult.step);

  process.stdout.write('\n  Verifying image metadata via docker inspect...\n');
  const inspectStep = await runStep('6.2 docker inspect kubernal-sample:13.3-demo', async () => {
    const result = await execFileAsync('docker', [
      'inspect',
      imageTag,
      '--format',
      '{{.Id}}|{{len .RootFS.Layers}}|{{.Config.Labels}}',
    ]);
    const stdout = result.stdout.trim();
    const [inspectId, layerCount, labels] = stdout.split('|');
    process.stdout.write(`     imageId:    ${inspectId}\n`);
    process.stdout.write(`     layers:     ${layerCount}\n`);
    process.stdout.write(`     labels:     ${labels}\n`);
    if (builtImageId && inspectId && !inspectId.includes(builtImageId)) {
      process.stdout.write(`     WARN: parsed id '${builtImageId}' not in inspect id '${inspectId}'\n`);
    }
    return { inspectId, layerCount, labels };
  });
  steps.push(inspectStep.step);

  process.stdout.write('\n  Cleaning up built image...\n');
  const cleanupStep = await runStep('7.1 docker rmi kubernal-sample:13.3-demo', async () => {
    try {
      await execFileAsync('docker', ['rmi', imageTag]);
      process.stdout.write(`     removed ${imageTag}\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`     WARN: docker rmi failed: ${message}\n`);
    }
  });
  steps.push(cleanupStep.step);

  printHeader('Summary (Phase 13.3)');
  for (const step of steps) {
    process.stdout.write(fmtStepResult(step) + '\n');
  }
  process.stdout.write(`\n  Pipeline status:    ${finalPipeline.status}\n`);
  process.stdout.write(`  Pipeline duration:  ${pipelineDuration}ms\n`);
  process.stdout.write(`  Steps executed:     ${pipelineSteps.length}\n`);
  process.stdout.write(`  Image tag:          ${builtImage ?? imageTag}\n`);
  process.stdout.write(`  Image id:           ${builtImageId ?? 'n/a'}\n`);
  process.stdout.write(`  Run output:         ${runStepResult.value ?? 'n/a'}\n`);
  process.stdout.write(`  Total duration:     ${Date.now() - start}ms\n`);
  process.stdout.write('\n' + '━'.repeat(78) + '\n\n');

  logger.info(
    {
      pipelineId: pipeline.id,
      finalStatus: finalPipeline.status,
      durationMs: pipelineDuration,
      stepCount: pipelineSteps.length,
      imageTag,
      imageId: builtImageId,
    },
    'Phase 13.3 pipeline demo complete',
  );
}

async function main(): Promise<void> {
  await runPhase131Demo();
  await runPhase132Demo();
  await runPhase133Demo();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nFatal error: ${message}\n`);
  if (error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(1);
});
