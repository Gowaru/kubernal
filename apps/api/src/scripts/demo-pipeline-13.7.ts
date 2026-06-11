/**
 * Phase 13.7 — Frontend E2E (build→push→scan→deploy)
 *
 * Reproduit le flux que la démo Firefox du 10 juin 2026 a validé visuellement
 * (screenshot du DeploymentDetail affichant un pipeline 4-steps en success).
 *
 * Pré-requis :
 *   - API démarrée sur http://127.0.0.1:4000
 *   - Registry local accessible sur http://localhost:5000
 *   - Cluster kind-kubernal up (kubectl + KUBECONFIG)
 *   - apps/api/test-fixtures/sample-app/ présent (Dockerfile FROM alpine:3.20)
 *
 * Usage :
 *   cd apps/api && npx tsx src/scripts/demo-pipeline-13.7.ts
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { db } from '../shared/database.js';
import { logger } from '../shared/logger.js';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000';
const TEAM_NAME = 'pipeline-demo-team';
const USER_EMAIL = 'pipeline-demo@kubernal.io';
const SAMPLE_APP_DIR = path.resolve(process.cwd(), 'test-fixtures', 'sample-app');
const execFileAsync = promisify(execFile);

const HORIZONTAL_RULE = '━'.repeat(78);

interface DemoStep {
  name: string;
  status: 'ok' | 'skipped' | 'failed' | 'pending';
  message: string;
  durationMs: number;
}

interface DataEnvelope<T> {
  data: T;
  total?: number;
}

interface Team {
  id: string;
}

interface User {
  id: string;
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
}

interface PipelineStep {
  action: string;
  status: string;
  errorMessage: string | null;
  output: unknown;
}

function printHeader(title: string): void {
  process.stdout.write('\n');
  process.stdout.write(HORIZONTAL_RULE + '\n');
  process.stdout.write(`  ${title}\n`);
  process.stdout.write(HORIZONTAL_RULE + '\n');
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

async function findOrCreateTeam(): Promise<Team> {
  const existing = await db.team.findUnique({ where: { name: TEAM_NAME } });
  if (existing) return existing;
  return db.team.create({
    data: {
      name: TEAM_NAME,
      description: 'Team created by Phase 13.7 frontend E2E demo',
      namespacePrefix: 'pipeline-demo-13-7',
    },
  });
}

async function findOrCreateUser(teamId: string): Promise<User> {
  const existing = await db.user.findUnique({ where: { email: USER_EMAIL } });
  if (existing) return existing;
  return db.user.create({
    data: { email: USER_EMAIL, name: 'Phase 13.7 Demo User', role: 'platform_engineer', teamId },
  });
}

async function findOrCreateTemplate(args: {
  name: string;
  description: string;
  teamId: string;
  createdById: string;
  steps: Array<{ id: string; name: string; action: string; input: Record<string, unknown> }>;
}): Promise<Template> {
  const existing = await db.goldenPathTemplate.findUnique({ where: { name: args.name } });
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  return api<DataEnvelope<Template>>('POST', '/api/v1/templates', {
    name: args.name,
    category: 'backend',
    description: args.description,
    repository: 'https://github.com/Gowaru/kubernal',
    teamId: args.teamId,
    createdById: args.createdById,
    parameters: {},
    steps: args.steps,
  }).then((res) => res.data);
}

async function findOrCreateApplication(args: {
  name: string;
  description: string;
  templateId: string;
  ownerId: string;
  teamId: string;
}): Promise<Application> {
  const existing = await db.application.findFirst({ where: { name: args.name } });
  if (existing) return { id: existing.id, name: existing.name };
  return api<DataEnvelope<Application>>('POST', '/api/v1/applications', {
    name: args.name,
    description: args.description,
    templateId: args.templateId,
    ownerId: args.ownerId,
    teamId: args.teamId,
    repositoryUrl: 'https://github.com/Gowaru/kubernal',
  }).then((res) => res.data);
}

async function findOrCreateEnvironment(args: {
  name: string;
  type: 'dev' | 'staging' | 'prod';
  applicationId: string;
  namespace: string;
}): Promise<Environment> {
  const existing = await db.environment.findFirst({
    where: { name: args.name, applicationId: args.applicationId },
  });
  if (existing) {
    return { id: existing.id, name: existing.name, namespace: existing.namespace };
  }
  return api<DataEnvelope<Environment>>('POST', '/api/v1/environments', {
    name: args.name,
    type: args.type,
    applicationId: args.applicationId,
    namespace: args.namespace,
  }).then((res) => res.data);
}

async function findOrCreateDeployment(args: {
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
}): Promise<Deployment> {
  const existing = await db.deployment.findFirst({
    where: { applicationId: args.applicationId, commitSha: args.commitSha },
  });
  if (existing) return { id: existing.id };
  return api<DataEnvelope<Deployment>>('POST', '/api/v1/deployments', {
    applicationId: args.applicationId,
    environmentId: args.environmentId,
    version: args.version,
    commitSha: args.commitSha,
    trigger: 'manual',
  }).then((res) => res.data);
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

async function main(): Promise<void> {
  const start = Date.now();
  const steps: DemoStep[] = [];
  const commitSha = `e2e13.7-${Date.now()}`;

  printHeader('Phase 13.7 — Frontend E2E (build→push→scan→deploy)');

  process.stdout.write('\n  Verifying pre-requisites...\n');
  const preReq = await runStep('1.0 check sample-app + registry + kind cluster', async () => {
    if (!existsSync(SAMPLE_APP_DIR)) {
      throw new Error(`sample-app not found at ${SAMPLE_APP_DIR}`);
    }
    if (!existsSync(path.join(SAMPLE_APP_DIR, 'Dockerfile'))) {
      throw new Error(`Dockerfile missing in ${SAMPLE_APP_DIR}`);
    }
    const { readFileSync } = await import('node:fs');
    process.stdout.write(`     context:    ${SAMPLE_APP_DIR}\n`);
    process.stdout.write(`     dockerfile: ${path.join(SAMPLE_APP_DIR, 'Dockerfile')}\n`);
    const dockerfile = readFileSync(path.join(SAMPLE_APP_DIR, 'Dockerfile'), 'utf8');
    for (const line of dockerfile.split('\n')) {
      process.stdout.write(`       ${line}\n`);
    }
    const registryRes = await fetch('http://localhost:5000/v2/');
    if (!registryRes.ok) {
      throw new Error(`local registry at http://localhost:5000 returned ${registryRes.status}`);
    }
    process.stdout.write(`     registry:   http://localhost:5000 (OK)\n`);
    await execFileAsync('kubectl', ['cluster-info', '--request-timeout=3s']);
    process.stdout.write(`     cluster:    kubectl reachable\n`);
  });
  steps.push(preReq.step);
  if (preReq.error) {
    process.stderr.write(`\nFatal: pre-requisites failed — ${preReq.error instanceof Error ? preReq.error.message : String(preReq.error)}\n\n`);
    process.exit(1);
  }

  process.stdout.write('\n  Setting up demo entities (team/user/template/app/env/deployment)...\n');
  const setup = await runStep('2.0 create template + app + env + deployment', async () => {
    const team = await findOrCreateTeam();
    const user = await findOrCreateUser(team.id);
    const template = await findOrCreateTemplate({
      name: `e2e-13-7-${Date.now()}`,
      description: 'Phase 13.7 frontend E2E: build→push→scan→deploy (no scaffold)',
      teamId: team.id,
      createdById: user.id,
      steps: [
        {
          id: 'build',
          name: 'Build sample image',
          action: 'build:image',
          input: {
            context: SAMPLE_APP_DIR,
            dockerfile: 'Dockerfile',
            image: 'localhost:5000/e2e-13-7:phase-13-7',
          },
        },
        {
          id: 'push',
          name: 'Push to local registry',
          action: 'push:image',
          input: { image: 'localhost:5000/e2e-13-7:phase-13-7' },
        },
        {
          id: 'scan',
          name: 'Scan for vulnerabilities',
          action: 'scan:image',
          input: {
            image: 'localhost:5000/e2e-13-7:phase-13-7',
            severity: ['CRITICAL', 'HIGH'],
            exitCode: false,
          },
        },
        {
          id: 'deploy',
          name: 'Deploy sample namespace',
          action: 'deploy:manifest',
          input: {
            manifests: [
              'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: e2e-13-7-ns\n',
            ],
            waitRollout: false,
          },
        },
      ],
    });
    const app = await findOrCreateApplication({
      name: 'e2e-13-7-app',
      description: 'Phase 13.7 frontend E2E app',
      templateId: template.id,
      ownerId: user.id,
      teamId: team.id,
    });
    const env = await findOrCreateEnvironment({
      name: 'dev',
      type: 'dev',
      applicationId: app.id,
      namespace: 'e2e-13-7-ns',
    });
    const deployment = await findOrCreateDeployment({
      applicationId: app.id,
      environmentId: env.id,
      version: `0.1.${Date.now() % 100}+sha.${commitSha.replace(/[^a-f0-9]/gi, '').slice(0, 7)}.branch.main`,
      commitSha,
    });
    return { template, app, env, deployment };
  });
  steps.push(setup.step);
  if (setup.error || !setup.value) {
    process.stderr.write(`\nFatal: setup failed — ${setup.error instanceof Error ? setup.error.message : String(setup.error)}\n\n`);
    process.exit(1);
  }
  const { template, deployment } = setup.value;

  process.stdout.write('\n  Executing 4-step pipeline (build→push→scan→deploy)...\n');
  const trigger = await runStep('3.0 POST /api/v1/pipelines/execute', async () => {
    const res = await api<DataEnvelope<Pipeline>>('POST', '/api/v1/pipelines/execute', {
      deploymentId: deployment.id,
      templateId: template.id,
      params: {},
    });
    return res.data;
  });
  steps.push(trigger.step);
  if (trigger.error || !trigger.value) {
    process.stderr.write(`\nFatal: pipeline trigger failed\n\n`);
    process.exit(1);
  }
  const pipeline = trigger.value;
  process.stdout.write(`     pipeline.id = ${pipeline.id}\n`);

  const finalPipeline = await pollPipelineCompletion(pipeline.id, 60);
  const pipelineDuration = finalPipeline.startedAt && finalPipeline.completedAt
    ? new Date(finalPipeline.completedAt).getTime() - new Date(finalPipeline.startedAt).getTime()
    : 0;

  const stepsRes = await api<DataEnvelope<PipelineStep[]>>(
    'GET',
    `/api/v1/pipelines/${finalPipeline.id}/steps`,
  );
  const pipelineSteps = stepsRes.data;

  process.stdout.write('\n  Step results:\n');
  for (const step of pipelineSteps) {
    const err = step.errorMessage ? ` err=${step.errorMessage.slice(0, 60)}` : '';
    process.stdout.write(`     ${step.action.padEnd(25)} ${step.status.padEnd(10)}${err}\n`);
  }

  process.stdout.write('\n  Verifying deployment via kubectl...\n');
  const verify = await runStep('4.0 kubectl get namespace e2e-13-7-ns', async () => {
    const result = await execFileAsync('kubectl', ['get', 'namespace', 'e2e-13-7-ns', '-o', 'name']);
    const out = result.stdout.trim();
    process.stdout.write(`     ${out}\n`);
    if (!out.includes('e2e-13-7-ns')) {
      throw new Error('namespace not found in cluster');
    }
    return out;
  });
  steps.push(verify.step);

  process.stdout.write('\n  Cleaning up local image + namespace...\n');
  const cleanup = await runStep('5.0 docker rmi + kubectl delete namespace', async () => {
    try {
      await execFileAsync('docker', ['rmi', 'localhost:5000/e2e-13-7:phase-13-7']);
    } catch {
      // ignore: image may have been removed already
    }
    try {
      await execFileAsync('kubectl', ['delete', 'namespace', 'e2e-13-7-ns']);
    } catch {
      // ignore
    }
  });
  steps.push(cleanup.step);

  printHeader('Summary (Phase 13.7 — Frontend E2E)');
  for (const step of steps) {
    process.stdout.write(fmtStepResult(step) + '\n');
  }
  process.stdout.write(`\n  Pipeline status:    ${finalPipeline.status}\n`);
  process.stdout.write(`  Pipeline duration:  ${pipelineDuration}ms\n`);
  process.stdout.write(`  Steps executed:     ${pipelineSteps.length}\n`);
  process.stdout.write(`  Total duration:     ${Date.now() - start}ms\n`);
  process.stdout.write('\n' + HORIZONTAL_RULE + '\n\n');
  process.stdout.write('  Next: open the UI at http://localhost:3000/deployments/' + deployment.id + '\n');
  process.stdout.write('  The DeploymentDetail page should display the pipeline timeline with all 4 steps in success state.\n\n');

  logger.info(
    {
      pipelineId: finalPipeline.id,
      finalStatus: finalPipeline.status,
      durationMs: pipelineDuration,
      stepCount: pipelineSteps.length,
      deploymentId: deployment.id,
    },
    'Phase 13.7 frontend E2E demo complete',
  );

  if (finalPipeline.status !== 'success') {
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nFatal error: ${message}\n`);
  if (error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(1);
});
