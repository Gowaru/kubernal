import { db } from '../../shared/database.js';
import { logger } from '../../shared/logger.js';
import { deploymentExecutor } from './deployment.executor.js';

const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 5 * 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;
const explicitQueue = new Set<string>();

export function startDeploymentWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    void runOnce();
  }, POLL_INTERVAL_MS);
  logger.info({ interval: POLL_INTERVAL_MS }, 'Deployment worker started');
}

export function stopDeploymentWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Deployment worker stopped');
  }
}

export async function triggerReconcile(deploymentId: string): Promise<void> {
  explicitQueue.add(deploymentId);
  await reconcileOne(deploymentId);
  explicitQueue.delete(deploymentId);
}

async function runOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const active = await db.deployment.findMany({
      where: { status: { in: ['building', 'deploying'] } },
      include: { application: true, environment: true },
    });

    for (const dep of active) {
      if (explicitQueue.has(dep.id)) continue;
      await reconcileOne(dep.id);
    }
  } catch (err) {
    logger.error({ err }, 'Worker runOnce failed');
  } finally {
    running = false;
  }
}

async function reconcileOne(deploymentId: string): Promise<void> {
  try {
    const dep = await db.deployment.findUnique({
      where: { id: deploymentId },
      include: { application: true, environment: true },
    });
    if (!dep) return;

    if (dep.status === 'deploying' || dep.status === 'building') {
      const age = Date.now() - new Date(dep.startedAt).getTime();
      if (age > TIMEOUT_MS) {
        await db.deployment.update({
          where: { id: dep.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            policyViolations: [
              { reason: 'timeout', message: `Reconcile timeout after ${TIMEOUT_MS}ms` },
            ],
          },
        });
        logger.warn({ id: dep.id, age }, 'Deployment marked failed (timeout)');
        return;
      }
    }

    await deploymentExecutor.reconcileStatus(dep);
  } catch (err) {
    logger.error({ err, deploymentId }, 'reconcileOne failed');
  }
}
