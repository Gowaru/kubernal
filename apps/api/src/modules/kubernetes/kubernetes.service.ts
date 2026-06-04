import {
  coreApi,
  kubeConfig,
  customObjectsApi,
} from '../../shared/k8s-client.js';
import { logger } from '../../shared/logger.js';
import {
  MOCK_PODS,
  MOCK_K8S_SERVICES,
  MOCK_EVENTS,
  MOCK_CLUSTER,
  MOCK_ARGO_STATUSES,
  MOCK_HPA,
  MOCK_CLAIMS,
} from './mock-data.js';
import type {
  K8sPod,
  K8sService,
  K8sEvent,
  K8sClusterContext,
  ArgoAppStatus,
  K8sHPAStatus,
  CrossplaneClaim,
} from '@kubernal/shared-types';

async function tryK8s<T>(
  realCall: () => Promise<T>,
  mockFallback: T,
  context: string,
): Promise<T> {
  try {
    return await realCall();
  } catch (err) {
    logger.warn({ context, error: String(err) }, 'K8s unavailable, using mock fallback');
    return mockFallback;
  }
}

export const kubernetesService = {
  async listPods(namespace: string): Promise<K8sPod[]> {
    return tryK8s(
      async () => {
        const res = await coreApi.listNamespacedPod({ namespace });
        return (res.items ?? []).map((item): K8sPod => {
          const podName = item.metadata?.name ?? '';
          const podNs = item.metadata?.namespace ?? namespace;
          const containers = (item.spec?.containers ?? []).map((c) => {
            const cs = (item.status?.containerStatuses ?? []).find(
              (s) => s.name === c.name,
            );
            const state = cs?.state?.running
              ? 'running'
              : cs?.state?.waiting
                ? 'waiting'
                : cs?.state?.terminated
                  ? 'terminated'
                  : 'running';
            return {
              name: c.name ?? '',
              image: c.image ?? '',
              ready: cs?.ready ?? false,
              restartCount: cs?.restartCount ?? 0,
              state: state as K8sPod['containers'][number]['state'],
              reason: (cs?.state?.waiting?.reason ??
                cs?.state?.terminated?.reason ??
                null) as string | null,
            };
          });
          const total = containers.length;
          const readyCount = containers.filter((c) => c.ready).length;
          return {
            id: item.metadata?.uid ?? `${podNs}/${podName}`,
            name: podName,
            namespace: podNs,
            nodeName: item.spec?.nodeName ?? '',
            status: (item.status?.phase ?? 'Unknown') as K8sPod['status'],
            ready: `${readyCount}/${total}`,
            restarts: containers.reduce((sum, c) => sum + c.restartCount, 0),
            ip: item.status?.podIP ?? null,
            age: item.metadata?.creationTimestamp
              ? ageSince(new Date(item.metadata.creationTimestamp))
              : '',
            startedAt: item.status?.startTime?.toISOString() ?? null,
            containers,
            labels: item.metadata?.labels ?? {},
          };
        });
      },
      MOCK_PODS.filter((p) => p.namespace === namespace),
      'listPods',
    );
  },

  async listServices(namespace: string): Promise<K8sService[]> {
    return tryK8s(
      async () => {
        const res = await coreApi.listNamespacedService({ namespace });
        return (res.items ?? []).map((svc): K8sService => ({
          name: svc.metadata?.name ?? '',
          namespace: svc.metadata?.namespace ?? namespace,
          type: (svc.spec?.type ?? 'ClusterIP') as K8sService['type'],
          clusterIP: svc.spec?.clusterIP ?? '',
          ports: (svc.spec?.ports ?? []).map((p) => ({
            name: p.name ?? '',
            port: p.port ?? 0,
            targetPort: typeof p.targetPort === 'number' ? p.targetPort : 0,
            protocol: p.protocol ?? 'TCP',
            nodePort: p.nodePort as number | undefined,
          })),
          selector: svc.spec?.selector ?? {},
          status: 'Active' as const,
          createdAt: svc.metadata?.creationTimestamp?.toISOString() ?? '',
        }));
      },
      MOCK_K8S_SERVICES.filter((s) => s.namespace === namespace),
      'listServices',
    );
  },

  async listEvents(namespace: string, limit: number): Promise<K8sEvent[]> {
    return tryK8s(
      async () => {
        const res = await coreApi.listNamespacedEvent({ namespace });
        const events = (res.items ?? []).map((evt): K8sEvent => ({
          id: evt.metadata?.uid ?? `${evt.metadata?.namespace}/${evt.metadata?.name}`,
          involvedObject: `${evt.involvedObject?.kind?.toLowerCase() ?? 'unknown'}/${evt.involvedObject?.name ?? ''}`,
          reason: evt.reason ?? '',
          message: evt.message ?? '',
          type: (evt.type ?? 'Normal') as K8sEvent['type'],
          count: evt.count ?? 1,
          lastTimestamp: evt.lastTimestamp?.toISOString() ?? evt.metadata?.creationTimestamp?.toISOString() ?? new Date().toISOString(),
          source: evt.source?.component ?? '',
        }));
        return events.slice(0, limit);
      },
      MOCK_EVENTS.filter((e) => {
        const objParts = e.involvedObject.split('/');
        const objNamespace = objParts.length > 1 ? (objParts[1]?.split(/[-.]/).slice(1).join('-') ?? '') : '';
        return e.involvedObject.includes(namespace) || objNamespace.includes(namespace);
      }).slice(0, limit),
      'listEvents',
    );
  },

  async getClusterInfo(): Promise<K8sClusterContext> {
    return tryK8s(
      async () => {
        const cluster = kubeConfig.getCurrentCluster();
        if (!cluster) throw new Error('No current cluster in kubeconfig');
        return {
          name: cluster.name ?? 'unknown',
          namespace: 'default',
          apiServerUrl: cluster.server ?? '',
          version: 'unknown',
          nodeCount: 0,
        };
      },
      MOCK_CLUSTER,
      'getClusterInfo',
    );
  },

  async getArgoStatus(application: string): Promise<ArgoAppStatus | null> {
    return MOCK_ARGO_STATUSES[application] ?? null;
  },

  async listHPA(namespace: string): Promise<K8sHPAStatus[]> {
    return tryK8s(
      async () => {
        const res = (await customObjectsApi.listNamespacedCustomObject({
          group: 'autoscaling',
          version: 'v2',
          namespace,
          plural: 'horizontalpodautoscalers',
        })) as { items?: Array<Record<string, unknown>> };
        return (res.items ?? []).map((item: Record<string, unknown>) => {
          const meta = (item.metadata ?? {}) as Record<string, unknown>;
          const spec = (item.spec ?? {}) as Record<string, unknown>;
          const status = (item.status ?? {}) as Record<string, unknown>;
          const metrics = (spec.metrics as Array<Record<string, unknown>>) ?? [];
          const cpuMetric = metrics.find(
            (m) => (m.resource as Record<string, unknown>)?.name === 'cpu',
          );
          return {
            name: (meta.name as string) ?? 'unknown',
            minReplicas: (spec.minReplicas as number) ?? 1,
            maxReplicas: (spec.maxReplicas as number) ?? 1,
            currentReplicas: (status.currentReplicas as number) ?? 0,
            desiredReplicas: (status.desiredReplicas as number) ?? 0,
            cpuTarget: cpuMetric
              ? ((cpuMetric.resource as Record<string, unknown>)?.target as Record<string, unknown>)?.averageUtilization as number ?? null
              : null,
            cpuCurrent: cpuMetric
              ? (status.currentCPUUtilizationPercentage as number) ?? null
              : null,
            memoryTarget: null,
            memoryCurrent: null,
          };
        });
      },
      Object.values(MOCK_HPA),
      'listHPA',
    );
  },

  async listClaims(namespace: string): Promise<CrossplaneClaim[]> {
    const allClaims = Object.values(MOCK_CLAIMS).flat();
    return tryK8s(
      async () => {
        void customObjectsApi;
        return allClaims.filter((c: CrossplaneClaim) => c.namespace === namespace);
      },
      allClaims.filter((c: CrossplaneClaim) => c.namespace === namespace),
      'listClaims',
    );
  },
};

function ageSince(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}
