const BASE_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 120_000;

let pipelinesStarted = 0;
let pipelinesSucceeded = 0;
let pipelinesFailed = 0;
let consecutiveErrors = 0;
let currentIntervalMs = BASE_INTERVAL_MS;
let workerStatus: 'running' | 'backoff' | 'stopped' = 'stopped';
let lastRunAt: string | null = null;
let lastErrorAt: string | null = null;

export const pipelineMetrics = {
  incStarted(): void {
    pipelinesStarted++;
  },
  incSucceeded(): void {
    pipelinesSucceeded++;
    consecutiveErrors = 0;
    currentIntervalMs = BASE_INTERVAL_MS;
    workerStatus = 'running';
  },
  incFailed(): void {
    pipelinesFailed++;
    consecutiveErrors++;
    currentIntervalMs = Math.min(currentIntervalMs * 2, MAX_INTERVAL_MS);
    workerStatus = consecutiveErrors > 2 ? 'backoff' : 'running';
  },
  markRunning(): void {
    workerStatus = 'running';
  },
  markStopped(): void {
    workerStatus = 'stopped';
  },
  setLastRunAt(iso: string): void {
    lastRunAt = iso;
  },
  setLastErrorAt(iso: string): void {
    lastErrorAt = iso;
  },
  getCurrentIntervalMs(): number {
    return currentIntervalMs;
  },
  snapshot(): {
    pipelinesStarted: number;
    pipelinesSucceeded: number;
    pipelinesFailed: number;
    consecutiveErrors: number;
    currentIntervalMs: number;
    workerStatus: string;
    lastRunAt: string | null;
    lastErrorAt: string | null;
  } {
    return {
      pipelinesStarted,
      pipelinesSucceeded,
      pipelinesFailed,
      consecutiveErrors,
      currentIntervalMs,
      workerStatus,
      lastRunAt,
      lastErrorAt,
    };
  },
};
