import { customObjectsApi, isK8sNotFound } from '../../shared/k8s-client.js';
import { logger } from '../../shared/logger.js';

/**
 * Création / maintenance des **Applications Argo CD** générées par la plateforme.
 *
 * Pour chaque couple (application, environnement) dont l'application porte une
 * config Git (`application.config.git = { branch, path }`) ET un `repositoryUrl`,
 * l'IDP crée une `Application` Argo CD nommée `k8sResourceName(app, env)`
 * (identique à `argoApplicationName` côté portail) dans le namespace `argocd`.
 *
 * Décision d'AppProject : on utilise le projet **`default`** fourni par Argo CD.
 * Justification (vérifiée sur le cluster `kind-kubernal`) :
 *   - `kubernal` restreint `sourceRepos` à `https://github.com/Gowaru/kubernal`
 *     ET `destinations` aux namespaces `kubernal-{dev,staging,prod}` → impossible
 *     de syncer `https://github.com/stefanprodan/podinfo` vers
 *     `platform-podinfo-demo-dev` ;
 *   - `default` (`kubectl get appproject default -n argocd -o yaml`) expose
 *     `sourceRepos: ['*']`, `destinations: [{server: '*', namespace: '*'}]` et
 *     `clusterResourceWhitelist: [{group: '*', kind: '*'}]` → largeur nécessaire
 *     pour un dépôt externe déclaré par un utilisateur final.
 * Aucun manifeste plateforme (`infra/argocd/projects/*`) n'a donc été modifié.
 */

const ARGO_GROUP = 'argoproj.io';
const ARGO_VERSION = 'v1alpha1';
const ARGO_PLURAL = 'applications';
const ARGO_NAMESPACE = 'argocd';
const ARGO_API_VERSION = 'argoproj.io/v1alpha1';
const CLUSTER_SERVER = 'https://kubernetes.default.svc';

export const ARGO_APP_PROJECT = 'default';

export interface EnsureArgoApplicationParams {
  /** `k8sResourceName(app, env)` — doit être le nom relu par `getArgoStatus`. */
  name: string;
  repoURL: string;
  targetRevision: string;
  path: string;
  /** Namespace de destination des manifests (celui de l'environnement). */
  namespace: string;
  /** Labels de debug additionnels (application, environnement, deployment-id…). */
  labels?: Record<string, string>;
}

interface ArgoSpec {
  project: string;
  source: { repoURL: string; targetRevision: string; path: string };
  destination: { server: string; namespace: string };
  syncPolicy: {
    automated: { prune: boolean; selfHeal: boolean };
    syncOptions: string[];
  };
}

function buildSpec(p: EnsureArgoApplicationParams): ArgoSpec {
  return {
    project: ARGO_APP_PROJECT,
    source: { repoURL: p.repoURL, targetRevision: p.targetRevision, path: p.path },
    destination: { server: CLUSTER_SERVER, namespace: p.namespace },
    syncPolicy: {
      automated: { prune: true, selfHeal: true },
      syncOptions: ['CreateNamespace=true'],
    },
  };
}

function buildLabels(p: EnsureArgoApplicationParams): Record<string, string> {
  return {
    'app.kubernetes.io/managed-by': 'kubernal',
    'kubernal.io/component': 'application',
    // Relie la CR à l'app + à l'environnement pour le debug (`<app>-<env>` inclus).
    'kubernal.io/application-env': p.name,
    ...(p.labels ?? {}),
  };
}

type ExistingApplication = {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    resourceVersion?: string;
    managedFields?: unknown;
    [key: string]: unknown;
  };
  spec?: Partial<ArgoSpec> & Record<string, unknown>;
};

/**
 * True si `spec` diverge de ce que la plateforme veut pour **source / destination /
 * project**.
 *
 * `syncPolicy` est volontairement **hors** de la comparaison : elle n'est écrite
 * qu'à la création, ensuite elle appartient à l'utilisateur
 * (`syncArgo` / `setAutoSync` du portail la modifient) — comparer la ré-écrirait
 * en boucle et annulerait la pause d'auto-sync.
 */
function isSpecDivergent(current: unknown, desired: ArgoSpec): boolean {
  const c = (current ?? {}) as Partial<ArgoSpec>;
  return (
    c.project !== desired.project ||
    c.source?.repoURL !== desired.source.repoURL ||
    c.source?.targetRevision !== desired.source.targetRevision ||
    c.source?.path !== desired.source.path ||
    c.destination?.server !== desired.destination.server ||
    c.destination?.namespace !== desired.destination.namespace
  );
}

/**
 * Crée (ou corrige si divergent) l'Application Argo CD décrite par `params`.
 *
 * Idempotent :
 *  - absente → `createNamespacedCustomObject` ;
 *  - présente et conforme → aucun appel réseau de écriture (`unchanged`) ;
 *  - présente mais `spec.source`/`spec.destination`/`spec.project` divergents →
 *    `replaceNamespacedCustomObject` (remplacement complet du `spec`, metadata
 *    conservée pour ne pas perdre les annotations de suivi d'Argo).
 *
 * En cas d'échec l'erreur est **propagée** : c'est l'appelant (l'executor de
 * déploiement) qui décide de la rendre non bloquante.
 */
export async function ensureArgoApplication(
  params: EnsureArgoApplicationParams,
): Promise<'created' | 'updated' | 'unchanged'> {
  const spec = buildSpec(params);
  const labels = buildLabels(params);
  const ref = { group: ARGO_GROUP, version: ARGO_VERSION, namespace: ARGO_NAMESPACE };

  let existing: ExistingApplication | null = null;
  try {
    existing = (await customObjectsApi.getNamespacedCustomObject({
      ...ref,
      plural: ARGO_PLURAL,
      name: params.name,
    })) as ExistingApplication;
  } catch (err: unknown) {
    if (!isK8sNotFound(err)) throw err;
  }

  if (!existing) {
    await customObjectsApi.createNamespacedCustomObject({
      ...ref,
      plural: ARGO_PLURAL,
      body: {
        apiVersion: ARGO_API_VERSION,
        kind: 'Application',
        metadata: { name: params.name, namespace: ARGO_NAMESPACE, labels },
        spec,
      },
    });
    logger.info(
      {
        application: params.name,
        repoURL: params.repoURL,
        targetRevision: params.targetRevision,
        path: params.path,
        destination: params.namespace,
        project: ARGO_APP_PROJECT,
      },
      'Argo CD Application created',
    );
    return 'created';
  }

  if (!isSpecDivergent(existing.spec, spec)) {
    return 'unchanged';
  }

  const { managedFields, ...metadata } = existing.metadata ?? {};
  void managedFields;
  await customObjectsApi.replaceNamespacedCustomObject({
    ...ref,
    plural: ARGO_PLURAL,
    name: params.name,
    body: {
      apiVersion: ARGO_API_VERSION,
      kind: 'Application',
      metadata: {
        ...metadata,
        name: params.name,
        namespace: ARGO_NAMESPACE,
        labels: { ...(metadata.labels ?? {}), ...labels },
      },
      spec,
    },
  });
  logger.info(
    {
      application: params.name,
      repoURL: params.repoURL,
      targetRevision: params.targetRevision,
      path: params.path,
      destination: params.namespace,
    },
    'Argo CD Application updated (spec diverged)',
  );
  return 'updated';
}
