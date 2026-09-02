import { claimNextPendingPipeline, executePipeline } from './executor.js';
import { pipelineMetrics } from './pipeline-metrics.js';

export function startPipelineWorker(options?: { intervalMs?: number }): { stop: () => void } {
  const baseIntervalMs = options?.intervalMs ?? 5_000;
  pipelineMetrics.markRunning();

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  function scheduleNext(): void {
    if (stopped) return;
    const intervalMs = pipelineMetrics.getCurrentIntervalMs();
    const delay = intervalMs !== baseIntervalMs ? intervalMs : baseIntervalMs;
    timer = setTimeout(() => {
      runOnce()
        .then((count) => {
          if (count > 0) {
            pipelineMetrics.incStarted();
          }
          pipelineMetrics.setLastRunAt(new Date().toISOString());
        })
        .catch((err) => {
          pipelineMetrics.incFailed();
          pipelineMetrics.setLastErrorAt(new Date().toISOString());
          console.error('[pipeline-worker] runOnce failed:', err);
        })
        .finally(() => {
          scheduleNext();
        });
    }, delay);
  }

  scheduleNext();

  return {
    stop(): void {
      stopped = true;
      pipelineMetrics.markStopped();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export async function runOnce(): Promise<number> {
  let count = 0;
  while (true) {
    const id = await claimNextPendingPipeline();
    if (!id) break;
    try {
      await executePipeline(id);
      pipelineMetrics.incSucceeded();
    } catch (err) {
      pipelineMetrics.incFailed();
      throw err;
    }
    count += 1;
  }
  pipelineMetrics.setLastRunAt(new Date().toISOString());
  return count;
}
