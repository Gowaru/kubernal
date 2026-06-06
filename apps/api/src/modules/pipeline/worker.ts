import { claimNextPendingPipeline, executePipeline } from './executor.js';

export function startPipelineWorker(
  options?: { intervalMs?: number },
): { stop: () => void } {
  const intervalMs = options?.intervalMs ?? 5000;
  const timer = setInterval(() => {
    runOnce().catch((err) => {
      console.error('[pipeline-worker] runOnce failed:', err);
    });
  }, intervalMs);
  return {
    stop: () => clearInterval(timer),
  };
}

export async function runOnce(): Promise<number> {
  let count = 0;
  while (true) {
    const id = await claimNextPendingPipeline();
    if (!id) break;
    await executePipeline(id);
    count += 1;
  }
  return count;
}
