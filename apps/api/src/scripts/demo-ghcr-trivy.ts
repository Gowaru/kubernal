import { logger } from '../shared/logger.js';
import {
  buildImageRef,
  parseImageRef,
  isGHCR,
  checkGHCRLogin,
  dockerTag,
  dockerPush,
  dockerPull,
} from '../shared/build/ghcr.js';
import { scanImage, DEFAULT_SEVERITY_THRESHOLD, type TrivyScanResult } from '../shared/build/trivy.js';
import { ensureGHCRPullSecretInNamespace, type PullSecretResult } from '../shared/build/k8s-pull-secret.js';
import { execSync } from 'node:child_process';

const DEMO_OWNER = 'gowaru';
const DEMO_APP = 'kubernal-test-nginx';
const DEMO_ENV = 'dev';
const DEMO_TAG = '1.0';
const DEMO_SOURCE_IMAGE = 'nginx:alpine';
const DEMO_NAMESPACE = 'default';

interface DemoStep {
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  message: string;
  durationMs: number;
}

function fmtStepResult(step: DemoStep): string {
  const icon = step.status === 'ok' ? '✓' : step.status === 'skipped' ? '⊘' : '✗';
  return `  ${icon} ${step.name.padEnd(45)} ${step.status.toUpperCase().padEnd(8)} (${step.durationMs}ms)`;
}

function runStep<T>(name: string, fn: () => T): { step: DemoStep; value?: T; error?: unknown } {
  const start = Date.now();
  try {
    const value = fn();
    return { step: { name, status: 'ok', message: 'OK', durationMs: Date.now() - start }, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      step: { name, status: 'failed', message, durationMs: Date.now() - start },
      error,
    };
  }
}

function printHeader(title: string): void {
  process.stdout.write('\n');
  process.stdout.write('━'.repeat(78) + '\n');
  process.stdout.write(`  ${title}\n`);
  process.stdout.write('━'.repeat(78) + '\n');
}

function printImageRefTable(ref: string): void {
  const parsed = parseImageRef(ref);
  if (!parsed) return;
  process.stdout.write(`\n  ┌─ Image reference\n`);
  process.stdout.write(`  │ registry: ${parsed.registry}\n`);
  process.stdout.write(`  │ owner:    ${parsed.owner}\n`);
  process.stdout.write(`  │ name:     ${parsed.name}\n`);
  process.stdout.write(`  │ tag:      ${parsed.tag}\n`);
  process.stdout.write(`  │ fullRef:  ${parsed.fullRef}\n`);
  process.stdout.write(`  │ isGHCR:   ${isGHCR(parsed.fullRef)}\n`);
  process.stdout.write(`  └─\n`);
}

function printScanResult(result: TrivyScanResult): void {
  process.stdout.write(`\n  ┌─ Trivy scan\n`);
  process.stdout.write(`  │ imageRef:  ${result.imageRef}\n`);
  process.stdout.write(`  │ scanner:   ${result.scanner}\n`);
  process.stdout.write(`  │ duration:  ${result.durationMs}ms\n`);
  process.stdout.write(`  │ threshold: ${result.threshold.join(',')}\n`);
  process.stdout.write(`  │\n`);
  process.stdout.write(`  │ Total vulnerabilities: ${result.total}\n`);
  process.stdout.write(`  │   CRITICAL: ${result.bySeverity.CRITICAL}\n`);
  process.stdout.write(`  │   HIGH:     ${result.bySeverity.HIGH}\n`);
  process.stdout.write(`  │   MEDIUM:   ${result.bySeverity.MEDIUM}\n`);
  process.stdout.write(`  │   LOW:      ${result.bySeverity.LOW}\n`);
  process.stdout.write(`  │\n`);
  process.stdout.write(`  │ Passed: ${result.passed ? 'YES (no CRITICAL)' : 'NO (CRITICAL found or scan failed)'}\n`);
  if (result.vulnerabilities.length > 0) {
    process.stdout.write(`  │\n`);
    process.stdout.write(`  │ Top 5 vulnerabilities:\n`);
    for (const v of result.vulnerabilities.slice(0, 5)) {
      process.stdout.write(`  │   - [${v.severity}] ${v.cveId} ${v.library}@${v.installedVersion} → ${v.fixedVersion ?? 'no fix'}\n`);
      process.stdout.write(`  │     ${v.title.slice(0, 100)}\n`);
    }
  }
  if (result.error) {
    process.stdout.write(`  │\n`);
    process.stdout.write(`  │ ERROR: ${result.error}\n`);
  }
  process.stdout.write(`  └─\n`);
}

function printPullSecretResult(result: PullSecretResult): void {
  process.stdout.write(`\n  ┌─ Pull secret\n`);
  process.stdout.write(`  │ namespace:      ${result.namespace}\n`);
  process.stdout.write(`  │ name:           ${result.name}\n`);
  process.stdout.write(`  │ created:        ${result.created}\n`);
  process.stdout.write(`  │ updated:        ${result.updated}\n`);
  process.stdout.write(`  │ alreadyExisted: ${result.alreadyExisted}\n`);
  if (result.error) {
    process.stdout.write(`  │ error:          ${result.error}\n`);
  }
  process.stdout.write(`  └─\n`);
}

async function main(): Promise<void> {
  const start = Date.now();
  const steps: DemoStep[] = [];
  const ghcrPassword = process.env.GITHUB_TOKEN ?? process.env.GHCR_TOKEN;

  printHeader('Phase 13.9 — GHCR + Trivy + imagePullSecret end-to-end demo');

  if (!ghcrPassword) {
    process.stdout.write('\n  ERROR: GITHUB_TOKEN or GHCR_TOKEN env var is required\n');
    process.stdout.write('  export GITHUB_TOKEN=ghp_xxx (GitHub PAT with write:packages scope)\n\n');
    process.exit(1);
  }

  const imageRef = buildImageRef(DEMO_OWNER, DEMO_APP, DEMO_ENV, DEMO_TAG);
  process.stdout.write(`\n  Source:  ${DEMO_SOURCE_IMAGE}\n`);
  process.stdout.write(`  Target:  ${imageRef}\n`);
  printImageRefTable(imageRef);

  process.stdout.write('\n  Checking prerequisites...\n');
  const prereqLogin = runStep('1.1 docker login ghcr.io (check)', () => {
    if (checkGHCRLogin()) {
      process.stdout.write('     Docker already logged in to ghcr.io\n');
      return;
    }
    process.stdout.write('     Docker not logged in to ghcr.io. Run: docker login ghcr.io\n');
    throw new Error('Not logged in to ghcr.io');
  });
  steps.push(prereqLogin.step);
  if (prereqLogin.error) {
    process.exit(1);
  }

  process.stdout.write('\n  Pulling source image...\n');
  const pullStep = runStep('2.1 docker pull nginx:alpine', () => {
    dockerPull(DEMO_SOURCE_IMAGE);
  });
  steps.push(pullStep.step);
  if (pullStep.error) {
    process.exit(1);
  }

  process.stdout.write('\n  Tagging + Pushing to GHCR...\n');
  const tagStep = runStep(`3.1 docker tag ${DEMO_SOURCE_IMAGE} → ${imageRef}`, () => {
    dockerTag(DEMO_SOURCE_IMAGE, imageRef);
  });
  steps.push(tagStep.step);

  const pushStep = runStep(`3.2 docker push ${imageRef}`, () => {
    dockerPush(imageRef);
  });
  steps.push(pushStep.step);
  if (pushStep.error) {
    process.exit(1);
  }

  process.stdout.write('\n  Running Trivy vulnerability scan...\n');
  const scanStep = runStep(`4.1 trivy scan ${imageRef}`, () => {
    const result = scanImage(imageRef, DEFAULT_SEVERITY_THRESHOLD);
    printScanResult(result);
    return result;
  });
  steps.push(scanStep.step);
  const scanResult = scanStep.value as TrivyScanResult | undefined;

  process.stdout.write('\n  Creating imagePullSecret in kind cluster...\n');
  const secretStep = runStep(`5.1 kubectl create secret docker-registry ghcr-pull -n ${DEMO_NAMESPACE}`, () => {
    const result = ensureGHCRPullSecretInNamespace(DEMO_NAMESPACE, DEMO_OWNER, ghcrPassword, 'ghcr-pull');
    printPullSecretResult(result);
    if (result.error) throw new Error(result.error);
    return result;
  });
  steps.push(secretStep.step);

  process.stdout.write('\n  Testing pull from kind cluster...\n');
  const kindPullStep = runStep(`6.1 kubectl apply pod with imagePullSecret=ghcr-pull`, () => {
    const podName = `test-pull-${Date.now()}`;
    process.stdout.write(`     Creating pod ${podName}...\n`);
    const podYaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${podName}
  namespace: ${DEMO_NAMESPACE}
spec:
  serviceAccount: default
  containers:
  - name: test
    image: ${imageRef}
    command: ["nginx", "-v"]
  restartPolicy: Never`;
    try {
      execSync(`echo '${podYaml}' | kubectl apply -f -`, { stdio: 'pipe' });
      process.stdout.write(`     Waiting for image pull (max 30s)...\n`);
      for (let i = 0; i < 30; i++) {
        execSync('sleep 1', { stdio: 'pipe' });
        const phase = execSync(
          `kubectl get pod ${podName} -n ${DEMO_NAMESPACE} -o jsonpath='{.status.containerStatuses[0].state}' 2>/dev/null || echo ''`,
          { encoding: 'utf8' },
        ).trim();
        if (phase.includes('"running"') || phase.includes('"terminated"')) {
          process.stdout.write(`     Container state: ${phase}\n`);
          const image = execSync(
            `kubectl get pod ${podName} -n ${DEMO_NAMESPACE} -o jsonpath='{.status.containerStatuses[0].image}'`,
            { encoding: 'utf8' },
          );
          process.stdout.write(`     Image pulled successfully: ${image.trim()}\n`);
          return;
        }
        if (phase.includes('"waiting"')) {
          const reason = execSync(
            `kubectl get pod ${podName} -n ${DEMO_NAMESPACE} -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || echo ''`,
            { encoding: 'utf8' },
          ).trim();
          if (reason === 'ErrImagePull' || reason === 'ImagePullBackOff') {
            throw new Error(`Image pull failed (reason: ${reason}). Check imagePullSecret.`);
          }
        }
      }
      throw new Error('Timeout waiting for image pull (30s)');
    } finally {
      try {
        execSync(`kubectl delete pod ${podName} -n ${DEMO_NAMESPACE} --grace-period=0 --force`, { stdio: 'pipe' });
      } catch {
        // ignore cleanup errors
      }
    }
  });
  steps.push(kindPullStep.step);

  printHeader('Summary');
  for (const step of steps) {
    process.stdout.write(fmtStepResult(step) + '\n');
  }
  process.stdout.write(`\n  Total duration: ${Date.now() - start}ms\n`);

  if (scanResult) {
    process.stdout.write(`\n  Image GHCR URL:    https://github.com/${DEMO_OWNER === 'gowaru' ? 'Gowaru' : DEMO_OWNER}/pkgs/container/${imageRef.replace(/^ghcr\.io\//, '').replace(':', '%3A')}\n`);
    process.stdout.write(`  Trivy scanner:     ${scanResult.scanner}\n`);
    process.stdout.write(`  Vulnerabilities:   ${scanResult.total} (${scanResult.bySeverity.CRITICAL} CRITICAL, ${scanResult.bySeverity.HIGH} HIGH)\n`);
  }
  process.stdout.write('\n' + '━'.repeat(78) + '\n\n');

  logger.info({ steps, totalDuration: Date.now() - start, scanResult }, 'Phase 13.9 demo complete');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\nFatal error: ${message}\n\n`);
  process.exit(1);
});
