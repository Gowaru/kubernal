import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'kubernal_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'kubernal_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const deploymentsCreated = new client.Counter({
  name: 'kubernal_deployments_total',
  help: 'Total number of deployments created',
  registers: [register],
});

const deploymentsStatus = new client.Gauge({
  name: 'kubernal_deployments_by_status',
  help: 'Current deployments by status',
  labelNames: ['status'],
  registers: [register],
});

export function trackRequest(method: string, route: string, status: number, durationMs: number): void {
  httpRequestDuration.observe({ method, route, status: String(status) }, durationMs / 1000);
  httpRequestsTotal.inc({ method, route, status: String(status) });
}

export function incrementDeployments(): void {
  deploymentsCreated.inc();
}

export function setDeploymentStatus(status: string, count: number): void {
  deploymentsStatus.set({ status }, count);
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}
