import {
  coreApi,
  appsApi,
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
  async listPods(namespace: string, labelSelector?: string): Promise<K8sPod[]> {
    return tryK8s(
      async () => {
        const mapItem = (item: { metadata?: { name?: string; namespace?: string; uid?: string; creationTimestamp?: Date | null; labels?: Record<string, string> }; spec?: { nodeName?: string; containers?: Array<{ name?: string; image?: string }> }; status?: { phase?: string; podIP?: string; startTime?: Date; containerStatuses?: Array<{ name?: string; ready?: boolean; restartCount?: number; state?: { running?: unknown; waiting?: { reason?: string }; terminated?: { reason?: string } } }> } }): K8sPod => {
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
        };

        if (!namespace || namespace === 'default') {
          const res = await coreApi.listPodForAllNamespaces();
          return (res.items ?? []).map(mapItem);
        }
        const res = await coreApi.listNamespacedPod({ namespace, ...(labelSelector ? { labelSelector } : {}) });
        return (res.items ?? []).map(mapItem);
      },
      !namespace || namespace === 'default'
        ? MOCK_PODS
        : MOCK_PODS.filter((p) => p.namespace === namespace),
      'listPods',
    );
  },

  async listServices(namespace: string): Promise<K8sService[]> {
    return tryK8s(
      async () => {
        const mapItem = (svc: { metadata?: { name?: string; namespace?: string; creationTimestamp?: Date | null }; spec?: { type?: string; clusterIP?: string; ports?: Array<{ name?: string; port?: number; targetPort?: number | string; protocol?: string; nodePort?: number }>; selector?: Record<string, string> } }): K8sService => ({
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
        });

        if (!namespace || namespace === 'default') {
          const res = await coreApi.listServiceForAllNamespaces();
          return (res.items ?? []).map(mapItem);
        }
        const res = await coreApi.listNamespacedService({ namespace });
        return (res.items ?? []).map(mapItem);
      },
      !namespace || namespace === 'default'
        ? MOCK_K8S_SERVICES
        : MOCK_K8S_SERVICES.filter((s) => s.namespace === namespace),
      'listServices',
    );
  },

  async listEvents(namespace: string, limit: number): Promise<K8sEvent[]> {
    return tryK8s(
      async () => {
        const mapItem = (evt: { metadata?: { name?: string; namespace?: string; uid?: string; creationTimestamp?: Date | null }; involvedObject?: { kind?: string; name?: string }; reason?: string; message?: string; type?: string; count?: number; lastTimestamp?: Date; source?: { component?: string } }): K8sEvent => ({
          id: evt.metadata?.uid ?? `${evt.metadata?.namespace}/${evt.metadata?.name}`,
          involvedObject: `${evt.involvedObject?.kind?.toLowerCase() ?? 'unknown'}/${evt.involvedObject?.name ?? ''}`,
          reason: evt.reason ?? '',
          message: evt.message ?? '',
          type: (evt.type ?? 'Normal') as K8sEvent['type'],
          count: evt.count ?? 1,
          lastTimestamp: evt.lastTimestamp?.toISOString() ?? evt.metadata?.creationTimestamp?.toISOString() ?? new Date().toISOString(),
          source: evt.source?.component ?? '',
        });
        if (!namespace || namespace === 'default') {
          const res = await coreApi.listEventForAllNamespaces();
          return (res.items ?? []).map(mapItem).slice(0, limit);
        }
        const res = await coreApi.listNamespacedEvent({ namespace });
        return (res.items ?? []).map(mapItem).slice(0, limit);
      },
      MOCK_EVENTS.slice(0, limit),
      'listEvents',
    );
  },

  async getClusterInfo(): Promise<K8sClusterContext> {
    return tryK8s(
      async () => {
        const cluster = kubeConfig.getCurrentCluster();
        if (!cluster) throw new Error('No current cluster in kubeconfig');
        const user = kubeConfig.getCurrentUser();
        const [nodesRes, versionRes] = await Promise.all([
          coreApi.listNode().catch(() => ({ items: [] })),
          fetch(`${cluster.server}/version`, {
            headers: { Authorization: `Bearer ${user?.token ?? ''}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        return {
          name: cluster.name ?? 'unknown',
          namespace: 'default',
          apiServerUrl: cluster.server ?? '',
          version:
            (versionRes as { gitVersion?: string } | null)?.gitVersion ??
            (cluster.name ? `cluster:${cluster.name}` : 'unknown'),
          nodeCount: (nodesRes.items ?? []).length,
        };
      },
      MOCK_CLUSTER,
      'getClusterInfo',
    );
  },

  async getArgoStatus(application: string): Promise<ArgoAppStatus | null> {
    return tryK8s(
      async () => {
        const res = (await customObjectsApi.getNamespacedCustomObject({
          group: 'argoproj.io',
          version: 'v1alpha1',
          namespace: 'argocd',
          plural: 'applications',
          name: application,
        }).catch(() => null)) as { status?: Record<string, unknown>; spec?: Record<string, unknown>; metadata?: { annotations?: Record<string, string> } } | null;
        if (!res) return null;
        const syncStatus = (res.status as { sync?: { status?: string } } | undefined)?.sync?.status ?? 'Unknown';
        const healthStatus = (res.status as { health?: { status?: string } } | undefined)?.health?.status ?? 'Unknown';
        const source = (res.spec as { source?: { repoURL?: string; targetRevision?: string; path?: string } } | undefined)?.source;
        const conditions = (res.status as { conditions?: Array<{ type?: string; message?: string }> } | undefined)?.conditions ?? [];
        const degradedCondition = conditions.find((c) => c.type === 'Degraded');
        return {
          sync: (syncStatus === 'Synced' ? 'synced' : 'out-of-sync') as ArgoAppStatus['sync'],
          health: (healthStatus === 'Healthy' ? 'healthy' : 'degraded') as ArgoAppStatus['health'],
          revision: source?.targetRevision ?? 'HEAD',
          branch: (source?.targetRevision ?? 'HEAD') as string,
          lastSyncAt: new Date().toISOString(),
          message: degradedCondition?.message ?? null,
        };
      },
      MOCK_ARGO_STATUSES[application] ?? null,
      'getArgoStatus',
    );
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

  async getPodLogs(
    namespace: string,
    name: string,
    options: { tailLines?: number; container?: string } = {},
  ): Promise<{ data: string; lines: string[]; namespace: string; name: string; container: string | null }> {
    const tailLines = options.tailLines ?? 100;
    const container = options.container ?? null;
    const result = await tryK8s(
      async () => {
        const data = await coreApi.readNamespacedPodLog({
          namespace,
          name,
          ...(container ? { container } : {}),
          tailLines,
        });
        const text = typeof data === 'string' ? data : String(data ?? '');
        const lines = text.split('\n').filter((l) => l.length > 0);
        return { data: text, lines, namespace, name, container };
      },
      { data: '', lines: [] as string[], namespace, name, container },
      'getPodLogs',
    );
    return result;
  },

  async scaleDeployment(
    namespace: string,
    name: string,
    replicas: number,
  ): Promise<{ kind: string; name: string; namespace: string; replicas: number }> {
    return tryK8s(
      async () => {
        const res = await appsApi.patchNamespacedDeployment({
          namespace,
          name,
          body: [{ op: 'replace', path: '/spec/replicas', value: replicas }],
        });
        return {
          kind: 'Deployment',
          name: res.metadata?.name ?? name,
          namespace: res.metadata?.namespace ?? namespace,
          replicas: res.spec?.replicas ?? replicas,
        };
      },
      { kind: 'Deployment', name, namespace, replicas },
      'scaleDeployment',
    );
  },

  async restartDeployment(
    namespace: string,
    name: string,
  ): Promise<{ kind: string; name: string; namespace: string; triggeredAt: string }> {
    const triggeredAt = new Date().toISOString();
    return tryK8s(
      async () => {
        await appsApi.patchNamespacedDeployment({
          namespace,
          name,
          fieldManager: 'kubernal-restart',
          body: [
            {
              op: 'replace',
              path: '/spec/template/metadata/annotations',
              value: { 'kubectl.kubernetes.io/restartedAt': triggeredAt },
            },
          ],
        });
        return { kind: 'DeploymentRolloutTriggered', name, namespace, triggeredAt };
      },
      { kind: 'DeploymentRolloutTriggered', name, namespace, triggeredAt },
      'restartDeployment',
    );
  },

  async deleteDeployment(
    namespace: string,
    name: string,
    options: { deleteService?: boolean } = {},
  ): Promise<{ deleted: true; name: string; namespace: string; serviceDeleted: boolean }> {
    const deleteService = options.deleteService ?? true;
    return tryK8s(
      async () => {
        await appsApi.deleteNamespacedDeployment({ namespace, name });
        let serviceDeleted = false;
        if (deleteService) {
          try {
            await coreApi.deleteNamespacedService({ namespace, name });
            serviceDeleted = true;
          } catch (err) {
            logger.warn({ namespace, name, error: String(err) }, 'deleteNamespacedService best-effort failed');
            serviceDeleted = false;
          }
        }
        return { deleted: true as const, name, namespace, serviceDeleted };
      },
      { deleted: true as const, name, namespace, serviceDeleted: false },
      'deleteDeployment',
    );
  },

  async execInPod(
    namespace: string,
    name: string,
    options: { command?: string[]; container?: string } = {},
  ): Promise<{
    kind: string;
    name: string;
    namespace: string;
    container: string | null;
    command: string[];
    requiresWebSocket: true;
    suggestion: string;
  }> {
    const command = options.command ?? ['/bin/sh'];
    const container = options.container ?? null;
    await tryK8s(
      async () => {
        await coreApi.readNamespacedPod({ name, namespace });
      },
      null,
      'execInPod',
    );
    return {
      kind: 'PodExecRequested',
      name,
      namespace,
      container,
      command,
      requiresWebSocket: true,
      suggestion: `kubectl exec -it -n ${namespace} ${name}${container ? ` -c ${container}` : ''} -- ${command.join(' ')}`,
    };
  },

  async getAccessInfo(
    namespace: string,
    deploymentName: string,
    _cluster = 'kubernal-prod',
  ): Promise<{
    namespace: string;
    deployment: string;
    type: 'nodeport' | 'clusterip' | 'none';
    urls: Array<{ port: number; nodePort?: number; url: string; kind: 'nodeport' | 'portforward' | 'internal' }>;
    serviceName: string | null;
    serviceType: string | null;
    ports: Array<{ name: string; port: number; nodePort: number | null; protocol: string }>;
    suggestion: string | null;
  }> {
    return tryK8s(
      async () => {
        const servicesRes = await coreApi.listNamespacedService({ namespace }).catch(() => ({
          items: [],
        }));
        const services =
          (servicesRes as {
            items?: Array<{
              metadata?: { name?: string };
              spec?: {
                type?: string;
                ports?: Array<{ name?: string; port?: number; nodePort?: number; protocol?: string }>;
              };
            }>;
          }).items ?? [];
        const matchingService =
          services.find((s) => s.metadata?.name === deploymentName) ?? services[0] ?? null;

        const urls: Array<{
          port: number;
          nodePort?: number;
          url: string;
          kind: 'nodeport' | 'portforward' | 'internal';
        }> = [];
        let type: 'nodeport' | 'clusterip' | 'none' = 'none';
        let suggestion: string | null = null;
        let serviceName: string | null = null;
        let serviceType: string | null = null;
        let ports: Array<{ name: string; port: number; nodePort: number | null; protocol: string }> = [];

        if (matchingService) {
          serviceName = matchingService.metadata?.name ?? null;
          serviceType = matchingService.spec?.type ?? 'ClusterIP';
          const rawPorts = matchingService.spec?.ports ?? [];
          ports = rawPorts.map((p) => ({
            name: p.name ?? '',
            port: p.port ?? 0,
            nodePort: p.nodePort ?? null,
            protocol: p.protocol ?? 'TCP',
          }));

          if (serviceType === 'NodePort') {
            type = 'nodeport';
            for (const p of ports) {
              if (p.nodePort === null) continue;
              urls.push({
                port: p.port,
                nodePort: p.nodePort,
                url: `http://localhost:${p.nodePort}`,
                kind: 'nodeport',
              });
            }
          } else {
            type = 'clusterip';
            for (const p of ports) {
              urls.push({
                port: p.port,
                url: `http://${serviceName}.${namespace}.svc.cluster.local:${p.port}`,
                kind: 'internal',
              });
            }
            if (ports[0]) {
              suggestion = `kubectl port-forward -n ${namespace} svc/${serviceName} 8080:${ports[0].port}`;
            }
          }
        } else {
          suggestion = `kubectl port-forward -n ${namespace} deployment/${deploymentName} 8080:8080`;
        }

        return {
          namespace,
          deployment: deploymentName,
          type,
          urls,
          serviceName,
          serviceType,
          ports,
          suggestion,
        };
      },
      {
        namespace,
        deployment: deploymentName,
        type: 'none' as const,
        urls: [],
        serviceName: null,
        serviceType: null,
        ports: [],
        suggestion: `kubectl port-forward -n ${namespace} deployment/${deploymentName} 8080:8080`,
      },
      'getAccessInfo',
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
