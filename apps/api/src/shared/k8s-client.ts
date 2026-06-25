import { existsSync } from 'node:fs';
import { KubeConfig, CoreV1Api, AppsV1Api, RbacAuthorizationV1Api, CustomObjectsApi, Exec, Log } from '@kubernetes/client-node';
import { logger } from './logger.js';

const kc = new KubeConfig();
const hasInClusterSA = existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token');

if (hasInClusterSA) {
  kc.loadFromCluster();
  logger.info('K8s client: using in-cluster config');
} else {
  kc.loadFromDefault();
  logger.info(
    { clusters: kc.getClusters().map((c) => c.name) },
    'K8s client: using default kubeconfig',
  );
}

export const kubeConfig = kc;
export const k8sExec = new Exec(kc);
export const k8sLog = new Log(kc);
export const getK8sConfig = (): KubeConfig => kc;
export const coreApi = kc.makeApiClient(CoreV1Api);
export const appsApi = kc.makeApiClient(AppsV1Api);
export const rbacApi = kc.makeApiClient(RbacAuthorizationV1Api);
export const customObjectsApi = kc.makeApiClient(CustomObjectsApi);

export type ResourceSplit = { cpu: string; memory: string };

export interface TeamEnvironment {
  type: string;
  cpuFactor: number;
  memoryFactor: number;
}

export const TEAM_ENVIRONMENTS: TeamEnvironment[] = [
  { type: 'dev', cpuFactor: 0.25, memoryFactor: 0.25 },
  { type: 'staging', cpuFactor: 0.25, memoryFactor: 0.25 },
  { type: 'prod', cpuFactor: 0.5, memoryFactor: 0.5 },
];

export function getTeamNamespaceNames(prefix: string): string[] {
  return TEAM_ENVIRONMENTS.map(e => `${prefix}-${e.type}`);
}

function parseCpu(cpu: string): number {
  if (cpu.endsWith('m')) return parseInt(cpu.slice(0, -1), 10);
  return Math.round(parseFloat(cpu) * 1000);
}

function formatCpu(millicores: number): string {
  if (millicores % 1000 === 0) return String(millicores / 1000);
  return `${millicores}m`;
}

function parseMemory(mem: string): number {
  const match = mem.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti)?$/);
  if (!match) return parseInt(mem, 10);
  const val = parseFloat(match[1]!);
  const unit = match[2] ?? 'Mi';
  const multipliers: Record<string, number> = { Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1048576 };
  return Math.round(val * (multipliers[unit] ?? 1));
}

function formatMemory(mi: number): string {
  if (mi >= 1024 && mi % 1024 === 0) return `${mi / 1024}Gi`;
  return `${mi}Mi`;
}

export function splitQuota(cpu: string, memory: string): ResourceSplit[] {
  const cpuMc = parseCpu(cpu);
  const memMi = parseMemory(memory);

  return TEAM_ENVIRONMENTS.map(e => ({
    cpu: formatCpu(Math.round(cpuMc * e.cpuFactor)),
    memory: formatMemory(Math.round(memMi * e.memoryFactor)),
  }));
}

export function getNamespaceLabels(teamName: string, teamId: string): Record<string, string> {
  return {
    'kubernal.io/managed-by': 'kubernal',
    'kubernal.io/team': teamName,
    'kubernal.io/team-id': teamId,
    'kubernal.io/type': 'team-namespace',
  };
}

export async function ensureNamespace(namespace: string, labels: Record<string, string>): Promise<void> {
  try {
    await coreApi.readNamespace({ name: namespace });
    logger.info({ namespace }, 'Namespace already exists');
  } catch (err: unknown) {
    if (isK8sNotFound(err)) {
      await coreApi.createNamespace({
        body: {
          metadata: {
            name: namespace,
            labels,
          },
        },
      });
      logger.info({ namespace }, 'Namespace created');
    } else {
      throw err;
    }
  }
}

export async function ensureResourceQuota(
  namespace: string,
  name: string,
  cpu: string,
  memory: string,
): Promise<void> {
  const manifest = {
    metadata: { name, namespace },
    spec: {
      hard: {
        'requests.cpu': cpu,
        'requests.memory': memory,
        'limits.cpu': cpu,
        'limits.memory': memory,
        'persistentvolumeclaims': '10',
        'count/deployments.apps': '50',
        'count/services': '50',
      },
    },
  };

  try {
    await coreApi.readNamespacedResourceQuota({ namespace, name });
    await coreApi.replaceNamespacedResourceQuota({
      namespace, name,
      body: manifest,
    });
    logger.info({ namespace, quota: name }, 'ResourceQuota updated');
  } catch (err: unknown) {
    if (isK8sNotFound(err)) {
      await coreApi.createNamespacedResourceQuota({
        namespace,
        body: manifest,
      });
      logger.info({ namespace, quota: name }, 'ResourceQuota created');
    } else {
      throw err;
    }
  }
}

export async function ensureLimitRange(namespace: string): Promise<void> {
  const manifest = {
    metadata: { name: 'team-default-limits', namespace },
    spec: {
      limits: [
        {
          default: { cpu: '500m', memory: '512Mi' },
          defaultRequest: { cpu: '100m', memory: '128Mi' },
          type: 'Container',
        },
      ],
    },
  };

  try {
    await coreApi.readNamespacedLimitRange({ namespace, name: 'team-default-limits' });
    logger.info({ namespace }, 'LimitRange already exists');
  } catch (err: unknown) {
    if (isK8sNotFound(err)) {
      await coreApi.createNamespacedLimitRange({
        namespace,
        body: manifest,
      });
      logger.info({ namespace }, 'LimitRange created');
    } else {
      throw err;
    }
  }
}

function isK8sNotFound(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return e['code'] === 404;
  }
  return false;
}
