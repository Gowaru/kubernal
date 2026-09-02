import type { V1Deployment, V1Service } from '@kubernetes/client-node';
import { appsApi, coreApi, ensureNamespace, kubeConfig } from '../../shared/k8s-client.js';
import { db } from '../../shared/database.js';
import { logger } from '../../shared/logger.js';
import { k8sResourceName } from '../../shared/k8s-utils.js';

const PLACEHOLDER_IMAGE = 'node:20-alpine';

interface DeploymentWithRelations {
  id: string;
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
  status: string;
  startedAt: Date;
  application: { id: string; name: string };
  environment: { id: string; name: string; type: string; namespace: string };
}

function buildDeploymentManifest(dep: DeploymentWithRelations): V1Deployment {
  const name = k8sResourceName(dep);
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace: dep.environment.namespace,
      labels: {
        app: dep.application.name,
        env: dep.environment.type,
        version: dep.version,
        'managed-by': 'kubernal-idp',
        'deployment-id': dep.id,
      },
    },
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: dep.application.name, env: dep.environment.type } },
      template: {
        metadata: {
          labels: { app: dep.application.name, env: dep.environment.type, version: dep.version },
        },
        spec: {
          containers: [
            {
              name: dep.application.name,
              image: PLACEHOLDER_IMAGE,
              command: [
                'sh',
                '-c',
                `while true; do echo "[idp] ${dep.application.name} ${dep.version} on ${dep.environment.type}"; sleep 10; done`,
              ],
              resources: {
                requests: { cpu: '50m', memory: '64Mi' },
                limits: { cpu: '200m', memory: '256Mi' },
              },
            },
          ],
        },
      },
    },
  };
}

function buildServiceManifest(dep: DeploymentWithRelations): V1Service {
  const name = k8sResourceName(dep);
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace: dep.environment.namespace,
      labels: {
        app: dep.application.name,
        env: dep.environment.type,
        'managed-by': 'kubernal-idp',
      },
    },
    spec: {
      type: 'ClusterIP',
      selector: { app: dep.application.name, env: dep.environment.type },
      ports: [{ port: 80, targetPort: 8080, protocol: 'TCP', name: 'http' }],
    },
  };
}

async function isK8sNotFound(err: unknown): Promise<boolean> {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return e['code'] === 404 || e['statusCode'] === 404;
  }
  return false;
}

export const deploymentExecutor = {
  k8sResourceName,

  async ensureK8sResources(dep: DeploymentWithRelations): Promise<'created' | 'exists'> {
    await ensureNamespace(dep.environment.namespace, { 'managed-by': 'kubernal-idp' });

    const name = k8sResourceName(dep);

    try {
      await appsApi.readNamespacedDeployment({ name, namespace: dep.environment.namespace });
      logger.info({ name, namespace: dep.environment.namespace }, 'K8s Deployment already exists');
    } catch (err: unknown) {
      if (await isK8sNotFound(err)) {
        await appsApi.createNamespacedDeployment({
          namespace: dep.environment.namespace,
          body: buildDeploymentManifest(dep),
        });
        logger.info({ name, namespace: dep.environment.namespace }, 'K8s Deployment created');
      } else {
        throw err;
      }
    }

    try {
      await coreApi.readNamespacedService({ name, namespace: dep.environment.namespace });
    } catch (err: unknown) {
      if (await isK8sNotFound(err)) {
        try {
          await coreApi.createNamespacedService({
            namespace: dep.environment.namespace,
            body: buildServiceManifest(dep),
          });
          logger.info({ name, namespace: dep.environment.namespace }, 'K8s Service created');
        } catch (svcErr: unknown) {
          logger.warn({ err: svcErr, name }, 'K8s Service creation failed (non-blocking)');
        }
      }
    }

    return 'created';
  },

  async reconcileStatus(dep: DeploymentWithRelations): Promise<void> {
    const name = k8sResourceName(dep);

    let k8sDep;
    try {
      k8sDep = await appsApi.readNamespacedDeployment({
        name,
        namespace: dep.environment.namespace,
      });
    } catch (err: unknown) {
      if (await isK8sNotFound(err)) {
        await this.ensureK8sResources(dep);
        return;
      }
      throw err;
    }

    const desired = k8sDep.spec?.replicas ?? 0;
    const ready = k8sDep.status?.readyReplicas ?? 0;
    const unavailable = k8sDep.status?.unavailableReplicas ?? 0;

    if (dep.status === 'building') {
      await db.deployment.update({
        where: { id: dep.id },
        data: { status: 'deploying' },
      });
      logger.info({ id: dep.id, name }, 'Transition: building → deploying');
      return;
    }

    if (dep.status === 'deploying') {
      if (ready === desired && desired > 0 && unavailable === 0) {
        await db.deployment.update({
          where: { id: dep.id },
          data: { status: 'healthy', completedAt: new Date() },
        });
        logger.info({ id: dep.id, name, ready, desired }, 'Transition: deploying → healthy');
      } else if (unavailable > 0) {
        const events = await coreApi.listNamespacedEvent({
          namespace: dep.environment.namespace,
        });
        const imagePullError = events.items.some(
          (e) =>
            e.involvedObject?.name?.startsWith(name) &&
            (e.reason === 'Failed' || e.reason === 'BackOff') &&
            e.message?.toLowerCase().includes('image'),
        );
        if (imagePullError) {
          await db.deployment.update({
            where: { id: dep.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              policyViolations: [{ reason: 'ImagePullBackOff', message: 'Failed to pull image' }],
            },
          });
          logger.warn({ id: dep.id, name }, 'Transition: deploying → failed (image pull)');
        }
      }
    }
  },
};

void kubeConfig;
