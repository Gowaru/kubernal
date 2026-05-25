import { KubeConfig, CoreV1Api, RbacAuthorizationV1Api } from '@kubernetes/client-node';
import { logger } from './logger.js';

const kc = new KubeConfig();

try {
  kc.loadFromCluster();
  logger.info('K8s client: using in-cluster config');
} catch {
  kc.loadFromDefault();
  logger.info('K8s client: using default kubeconfig');
}

export const coreApi = kc.makeApiClient(CoreV1Api);
export const rbacApi = kc.makeApiClient(RbacAuthorizationV1Api);

export function getNamespaceLabels(teamName: string, teamId: string): Record<string, string> {
  return {
    'kubernal.io/managed-by': 'kubernal',
    'kubernal.io/team': teamName,
    'kubernal.io/team-id': teamId,
    'kubernal.io/type': 'team-namespace',
  };
}

export async function ensureNamespace(namespace: string, labels: Record<string, string>) {
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
) {
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

export async function ensureLimitRange(namespace: string) {
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
