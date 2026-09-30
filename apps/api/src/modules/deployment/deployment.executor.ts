import type { V1Deployment, V1Ingress, V1Service } from '@kubernetes/client-node';
import {
  appsApi,
  coreApi,
  ensureNamespace,
  kubeConfig,
  networkingApi,
} from '../../shared/k8s-client.js';
import { db } from '../../shared/database.js';
import { logger } from '../../shared/logger.js';
import { k8sResourceName } from '../../shared/k8s-utils.js';
import { ensureArgoApplication } from '../kubernetes/argo-application.js';
import { kubernetesService } from '../kubernetes/kubernetes.service.js';

const PLACEHOLDER_IMAGE = 'node:20-alpine';

/** Labels posés sur TOUTE ressource créée par l'executor (placeholder). */
const PLACEHOLDER_OWNERSHIP = { 'managed-by': 'kubernal-idp' } as const;

interface DeploymentWithRelations {
  id: string;
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
  status: string;
  startedAt: Date;
  application: {
    id: string;
    name: string;
    /** Absent uniquement sur les fixtures de test : force alors le mode placeholder. */
    repositoryUrl?: string | null;
    /** `application.config` (Json Prisma) — porte éventuellement `config.git`. */
    config?: unknown;
  };
  environment: { id: string; name: string; type: string; namespace: string };
}

/** `application.config.git` normalisé. */
export interface GitConfig {
  branch: string;
  path: string;
}

export type DeploymentMode = 'placeholder' | 'argo';

/**
 * Lit `application.config.git = { branch?, path }`.
 *
 * Renvoie `null` (→ mode placeholder, comportement historique inchangé) si :
 *  - `config` n'est pas un objet, ou
 *  - `config.git` n'est pas un objet, ou
 *  - `config.git.path` est absent/vides (exigence : un path sans repo n'a pas de sens).
 * `branch` est optionnel côté données : défaut `main`.
 */
export function resolveGitConfig(dep: DeploymentWithRelations): GitConfig | null {
  const config = dep.application?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const git = (config as Record<string, unknown>).git;
  if (!git || typeof git !== 'object' || Array.isArray(git)) return null;
  const g = git as Record<string, unknown>;
  const path = typeof g.path === 'string' ? g.path.trim() : '';
  if (!path) return null;
  const branch = typeof g.branch === 'string' && g.branch.trim() ? g.branch.trim() : 'main';
  return { branch, path };
}

/**
 * Mode Argo **si et seulement si** `config.git` est complet ET que l'application
 * possède un `repositoryUrl` (sans dépôt, rien à syncer → on garde le placeholder).
 */
export function resolveDeploymentMode(dep: DeploymentWithRelations): DeploymentMode {
  if (!resolveGitConfig(dep)) return 'placeholder';
  return dep.application?.repositoryUrl ? 'argo' : 'placeholder';
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
        ...PLACEHOLDER_OWNERSHIP,
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
        ...PLACEHOLDER_OWNERSHIP,
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

/** Backend Ingress : service ClusterIP + port cible. */
export interface IngressBackend {
  service: string;
  port: number;
}

/**
 * Ingress de l'environnement, nommée comme le Deployment/Service (`<app>-<env>`).
 *
 * Deux règles coexistent pour garantir un accès **sans DNS** :
 *  - path-based (sans host) : `http://<ingress-host>:<ingress-port>/<app>-<env>/<path>`
 *    → location regex `/<app>-<env>(/|$)(.*)`, réécrit en `/$2` (le préfixe de l'app est
 *      retiré, la capture $2 devient le chemin réel côté backend) ;
 *  - host-based : `http://<app>-<env>.kubernal.local/<path>` (si DNS/hosts configuré).
 *
 * La règle host-based utilise elle aussi 2 groupes de capture — `/()(.*)` (inoffensif,
 * réécrit en `/$2` = chemin inchangé) — car `rewrite-target` est global à l'Ingress :
 * un chemin littéral `/` serait réécrit en `/$2` = `/` et avalerait tous les sous-chemins.
 * `pathType: ImplementationSpecific` est requis pour autoriser ces motifs regex.
 *
 * `backend` est paramétré : en mode placeholder c'est le Service `<app>-<env>` créé par
 * l'IDP, en mode Argo c'est le Service réellement déployé par Argo (découvert, voir
 * `discoverIngressBackend`).
 */
function buildIngressManifest(dep: DeploymentWithRelations, backend: IngressBackend): V1Ingress {
  const name = k8sResourceName(dep);
  const service = { service: { name: backend.service, port: { number: backend.port } } };

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name,
      namespace: dep.environment.namespace,
      labels: {
        app: dep.application.name,
        env: dep.environment.type,
        ...PLACEHOLDER_OWNERSHIP,
      },
      annotations: {
        'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
        'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
      },
    },
    spec: {
      ingressClassName: 'nginx',
      rules: [
        {
          http: {
            paths: [
              {
                path: `/${name}(/|$)(.*)`,
                pathType: 'ImplementationSpecific',
                backend: service,
              },
            ],
          },
        },
        {
          host: `${name}.kubernal.local`,
          http: {
            paths: [
              {
                path: '/()(.*)',
                pathType: 'ImplementationSpecific',
                backend: service,
              },
            ],
          },
        },
      ],
    },
  };
}

/** Identité lisible des backends d'une Ingress (host|path|service|port), triée. */
function ingressBackendKeys(ing: V1Ingress): string[] {
  const keys: string[] = [];
  for (const rule of ing.spec?.rules ?? []) {
    for (const p of rule.http?.paths ?? []) {
      keys.push(
        `${rule.host ?? ''}|${p.path}|${p.backend.service?.name ?? ''}|${p.backend.service?.port?.number ?? ''}`,
      );
    }
  }
  return keys.sort();
}

/**
 * Crée l'Ingress si absente ; la met à jour si son backend a changé (transition
 * placeholder → Argo : le Service `<app>-<env>` disparaît au profit du Service réel
 * de l'application) ; sinon rien.
 *
 * Comme pour la Service, un échec ici est **non bloquant** : on logge un warning et le
 * déploiement continue. Justification : l'Ingress est une convenance de routage (l'app
 * reste joignable via ClusterIP / `kubectl port-forward`), alors que faire échouer le
 * déploiement priverait l'utilisateur d'un workload pourtant valide — comportement le
 * plus sûr pour l'utilisateur. Le prochain passage de `ensureK8sResources` retentera.
 */
async function ensureIngress(
  dep: DeploymentWithRelations,
  backend: IngressBackend,
): Promise<'created' | 'updated' | 'exists'> {
  const name = k8sResourceName(dep);
  const desired = buildIngressManifest(dep, backend);

  let existing: V1Ingress | null = null;
  try {
    existing = await networkingApi.readNamespacedIngress({
      name,
      namespace: dep.environment.namespace,
    });
  } catch (err: unknown) {
    if (!(await isK8sNotFound(err))) throw err;
  }

  if (!existing) {
    await networkingApi.createNamespacedIngress({
      namespace: dep.environment.namespace,
      body: desired,
    });
    return 'created';
  }

  const currentKeys = ingressBackendKeys(existing).join('\n');
  const desiredKeys = ingressBackendKeys(desired).join('\n');
  if (currentKeys === desiredKeys) return 'exists';

  await networkingApi.replaceNamespacedIngress({
    name,
    namespace: dep.environment.namespace,
    body: {
      ...desired,
      metadata: {
        ...(existing.metadata ?? {}),
        ...desired.metadata,
        labels: {
          ...(existing.metadata?.labels ?? {}),
          ...(desired.metadata?.labels ?? {}),
        },
        annotations: {
          ...(existing.metadata?.annotations ?? {}),
          ...(desired.metadata?.annotations ?? {}),
        },
      },
    },
  });
  return 'updated';
}

type ServicePort = NonNullable<NonNullable<V1Service['spec']>['ports']>[number];

/** Port HTTP d'une Service : nom `http`/`https` de préférence, sinon 80, sinon le 1er. */
function pickServicePort(ports: ServicePort[] | undefined): number | null {
  const list: ServicePort[] = ports ?? [];
  if (list.length === 0) return null;
  const named = list.find((p) => p.name && ['http', 'http-alt', 'web', 'https'].includes(p.name));
  if (named?.port) return named.port;
  const port80 = list.find((p) => p.port === 80);
  if (port80?.port) return port80.port;
  const first = list.find((p) => p.port !== undefined);
  return first?.port ?? null;
}

/**
 * Ordre de préférence entre Services candidats : le Service nommé comme
 * l'application d'abord, puis les préfixés, puis le reste.
 */
function serviceScore(serviceName: string, applicationName: string): number {
  if (serviceName === applicationName) return 0;
  if (serviceName.startsWith(`${applicationName}-`)) return 1;
  if (serviceName.includes(applicationName)) return 2;
  // Argo peut nommer le Service différemment (ex. app `podinfo-demo`, svc `podinfo`).
  if (applicationName.startsWith(serviceName)) return 3;
  return 4;
}

/** True si la Service a au moins une endpoint **prête** (address, pas notReady). */
async function hasActiveEndpoints(namespace: string, serviceName: string): Promise<boolean> {
  try {
    const ep = await coreApi.readNamespacedEndpoints({ namespace, name: serviceName });
    return (ep.subsets ?? []).some((s) => (s.addresses ?? []).length > 0);
  } catch (err: unknown) {
    logger.debug({ namespace, serviceName, err: String(err) }, 'Endpoints lookup failed');
    return false;
  }
}

/**
 * Découvre le backend Ingress en mode Argo.
 *
 * Argo crée SES propres ressources (ici `svc/podinfo`), dont le nom est inconnu à
 * l'avance : on liste les Services ClusterIP du namespace (en excluant le placeholder
 * `<app>-<env>` que l'executor vient de supprimer), on les trie par pertinence avec le
 * nom de l'application, et on retient le premier qui a des **endpoints actifs**.
 * Aucun candidat → `null` : l'Ingress est reportée au cycle suivant (non bloquant),
 * le temps qu'Argo synchronise les manifests et que les pods soient prêts.
 */
async function discoverIngressBackend(
  dep: DeploymentWithRelations,
  excludedNames: Set<string>,
): Promise<IngressBackend | null> {
  const namespace = dep.environment.namespace;
  const applicationName = dep.application.name;

  let items: V1Service[] = [];
  try {
    const res = await coreApi.listNamespacedService({ namespace });
    items = (res.items ?? []) as V1Service[];
  } catch (err: unknown) {
    logger.warn({ namespace, err: String(err) }, 'Service listing failed (Ingress deferred)');
    return null;
  }

  const candidates = items
    .filter((svc) => {
      const n = svc.metadata?.name;
      if (!n || excludedNames.has(n) || n === 'kubernetes') return false;
      return svc.spec?.type !== 'ExternalName';
    })
    .sort(
      (a, b) =>
        serviceScore(a.metadata?.name ?? '', applicationName) -
        serviceScore(b.metadata?.name ?? '', applicationName),
    );

  for (const svc of candidates) {
    const svcName = svc.metadata?.name;
    if (!svcName) continue;
    const port = pickServicePort(svc.spec?.ports);
    if (!port) continue;
    if (!(await hasActiveEndpoints(namespace, svcName))) continue;
    return { service: svcName, port };
  }
  return null;
}

/** True si cette ressource a été créée par l'executor (placeholder) ET concerne bien
 * cette application/environnement — on ne supprime JAMAIS les ressources d'Argo. */
function isOwnedPlaceholder(
  meta: { labels?: Record<string, string> } | undefined,
  dep: DeploymentWithRelations,
): boolean {
  const labels = meta?.labels ?? {};
  return (
    labels['managed-by'] === PLACEHOLDER_OWNERSHIP['managed-by'] &&
    labels['app'] === dep.application.name &&
    labels['env'] === dep.environment.type
  );
}

/**
 * Supprime le Deployment + Service placeholder (`<app>-<env>`) laissés par l'IDP avant
 * le passage en mode Argo — uniquement s'ils portent nos labels d'appartenance.
 * Les ressources d'Argo (ex. `svc/podinfo`) n'ont pas ces labels : elles survivent.
 * Nettoyage best-effort : une erreur logge un warning, le prochain cycle retentera.
 */
async function removePlaceholderWorkload(
  dep: DeploymentWithRelations,
  name: string,
): Promise<void> {
  const namespace = dep.environment.namespace;

  try {
    const existing = await appsApi.readNamespacedDeployment({ name, namespace });
    if (isOwnedPlaceholder(existing.metadata, dep)) {
      await appsApi.deleteNamespacedDeployment({ name, namespace });
      logger.info({ name, namespace }, 'Placeholder K8s Deployment removed (Argo mode)');
    } else {
      logger.warn(
        { name, namespace },
        'K8s Deployment with placeholder name is not owned by kubernal-idp — left untouched',
      );
    }
  } catch (err: unknown) {
    if (!(await isK8sNotFound(err))) {
      logger.warn({ err, name, namespace }, 'Placeholder Deployment cleanup failed (non-blocking)');
    }
  }

  try {
    const existing = await coreApi.readNamespacedService({ name, namespace });
    if (isOwnedPlaceholder(existing.metadata, dep)) {
      await coreApi.deleteNamespacedService({ name, namespace });
      logger.info({ name, namespace }, 'Placeholder K8s Service removed (Argo mode)');
    } else {
      logger.warn(
        { name, namespace },
        'K8s Service with placeholder name is not owned by kubernal-idp — left untouched',
      );
    }
  } catch (err: unknown) {
    if (!(await isK8sNotFound(err))) {
      logger.warn({ err, name, namespace }, 'Placeholder Service cleanup failed (non-blocking)');
    }
  }
}

/**
 * Chemin Argo : CR Application → nettoyage du placeholder → Ingress découverte.
 * Rien n'est bloquant ici : l'état réel est lu ensuite par `reconcileStatus` via
 * `getArgoStatus`, et chaque échec est repris au cycle de réconciliation suivant.
 */
async function ensureArgoManagedResources(
  dep: DeploymentWithRelations,
  name: string,
): Promise<void> {
  const git = resolveGitConfig(dep);
  const repoURL = dep.application.repositoryUrl;
  if (!git || !repoURL) return;

  try {
    const state = await ensureArgoApplication({
      name,
      repoURL,
      targetRevision: git.branch,
      path: git.path,
      namespace: dep.environment.namespace,
      labels: {
        'kubernal.io/application': dep.application.name,
        'kubernal.io/environment': dep.environment.type,
        'kubernal.io/deployment-id': dep.id,
      },
    });
    logger.info(
      {
        name,
        state,
        repoURL,
        targetRevision: git.branch,
        path: git.path,
        destination: dep.environment.namespace,
      },
      'Argo CD Application ensured',
    );
  } catch (err: unknown) {
    logger.error(
      { err, name, deploymentId: dep.id },
      'Argo CD Application ensure failed (non-blocking for the deployment, will be retried)',
    );
  }

  await removePlaceholderWorkload(dep, name);

  try {
    const backend = await discoverIngressBackend(dep, new Set([name]));
    if (!backend) {
      logger.info(
        { name, namespace: dep.environment.namespace },
        'Argo mode: no Service with active endpoints yet — Ingress deferred to next cycle',
      );
      return;
    }
    const ingressState = await ensureIngress(dep, backend);
    logger.info(
      { name, namespace: dep.environment.namespace, backend, state: ingressState },
      `K8s Ingress ${ingressState}`,
    );
  } catch (ingErr: unknown) {
    logger.warn(
      { err: ingErr, name, namespace: dep.environment.namespace },
      'K8s Ingress creation failed (non-blocking)',
    );
  }
}

/** Chemin historique : Deployment + Service placeholder + Ingress. Inchangé. */
async function ensurePlaceholderResources(
  dep: DeploymentWithRelations,
  name: string,
): Promise<void> {
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

  // Ingress : non bloquant — une erreur de routage ne doit pas faire échouer le
  // déploiement (voir ensureIngress).
  try {
    const ingressState = await ensureIngress(dep, { service: name, port: 80 });
    if (ingressState === 'created') {
      logger.info({ name, namespace: dep.environment.namespace }, 'K8s Ingress created');
    }
  } catch (ingErr: unknown) {
    logger.warn(
      { err: ingErr, name, namespace: dep.environment.namespace },
      'K8s Ingress creation failed (non-blocking)',
    );
  }
}

/**
 * Statut en mode Argo : on ne regarde PLUS le Deployment K8s `<app>-<env>` (il n'existe
 * pas — ce sont Argo et ses manifests qui pilotent le workload). On lit la CR
 * `Application` Argo CD du même nom :
 *  - `Synced` + `Healthy` → `healthy`
 *  - `Degraded` ou erreur de comparaison/parsing du repo → `failed`
 *  - sinon (`OutOfSync`, `Progressing`, `Unknown`, CR absente…) → on reste `deploying`
 */
async function reconcileArgoStatus(dep: DeploymentWithRelations, name: string): Promise<void> {
  if (dep.status === 'building') {
    await db.deployment.update({ where: { id: dep.id }, data: { status: 'deploying' } });
    logger.info({ id: dep.id, name }, 'Transition: building → deploying (Argo mode)');
    return;
  }
  if (dep.status !== 'deploying') return;

  const status = await kubernetesService.getArgoStatus(name).catch((err: unknown) => {
    logger.warn({ err, name }, 'getArgoStatus failed — keeping deployment in "deploying"');
    return null;
  });

  if (!status) {
    logger.debug({ id: dep.id, name }, 'Argo Application not visible yet — waiting');
    return;
  }

  if (status.health === 'Degraded' || status.error) {
    await db.deployment.update({
      where: { id: dep.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        policyViolations: [
          {
            reason: 'ArgoCD',
            message: status.message ?? `Argo CD sync=${status.sync} health=${status.health}`,
          },
        ],
      },
    });
    logger.warn(
      { id: dep.id, name, sync: status.sync, health: status.health },
      'Transition: deploying → failed (Argo CD)',
    );
    return;
  }

  if (status.sync === 'Synced' && status.health === 'Healthy') {
    await db.deployment.update({
      where: { id: dep.id },
      data: { status: 'healthy', completedAt: new Date() },
    });
    logger.info({ id: dep.id, name }, 'Transition: deploying → healthy (Argo CD)');
  }
}

export const deploymentExecutor = {
  k8sResourceName,
  resolveGitConfig,
  resolveDeploymentMode,

  async ensureK8sResources(dep: DeploymentWithRelations): Promise<'created' | 'exists'> {
    await ensureNamespace(dep.environment.namespace, { ...PLACEHOLDER_OWNERSHIP });

    const name = k8sResourceName(dep);

    if (resolveDeploymentMode(dep) === 'argo') {
      await ensureArgoManagedResources(dep, name);
      return 'created';
    }

    await ensurePlaceholderResources(dep, name);
    return 'created';
  },

  async reconcileStatus(dep: DeploymentWithRelations): Promise<void> {
    const name = k8sResourceName(dep);
    const mode = resolveDeploymentMode(dep);

    // Idempotent : garantit les ressources à chaque cycle, y compris lors d'un
    // redéploiement (les ressources existent déjà → l'ancien chemin ne créait rien).
    await this.ensureK8sResources(dep);

    if (mode === 'argo') {
      await reconcileArgoStatus(dep, name);
      return;
    }

    let k8sDep;
    try {
      k8sDep = await appsApi.readNamespacedDeployment({
        name,
        namespace: dep.environment.namespace,
      });
    } catch (err: unknown) {
      if (await isK8sNotFound(err)) {
        // Vient d'être créé : on laisse le cycle suivant observer l'état.
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
