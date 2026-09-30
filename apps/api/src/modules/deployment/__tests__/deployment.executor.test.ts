import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deploymentExecutor,
  resolveDeploymentMode,
  resolveGitConfig,
} from '../deployment.executor.js';
import { ensureArgoApplication } from '../../kubernetes/argo-application.js';
import { kubernetesService } from '../../kubernetes/kubernetes.service.js';
import { appsApi, coreApi, networkingApi, ensureNamespace } from '../../../shared/k8s-client.js';
import { db } from '../../../shared/database.js';

vi.mock('../../../shared/k8s-client.js', () => ({
  ensureNamespace: vi.fn().mockResolvedValue(undefined),
  kubeConfig: {},
  appsApi: {
    readNamespacedDeployment: vi.fn(),
    createNamespacedDeployment: vi.fn(),
    deleteNamespacedDeployment: vi.fn(),
  },
  coreApi: {
    readNamespacedService: vi.fn(),
    createNamespacedService: vi.fn(),
    deleteNamespacedService: vi.fn(),
    listNamespacedService: vi.fn(),
    readNamespacedEndpoints: vi.fn(),
    listNamespacedEvent: vi.fn(),
  },
  networkingApi: {
    readNamespacedIngress: vi.fn(),
    createNamespacedIngress: vi.fn(),
    replaceNamespacedIngress: vi.fn(),
  },
}));

vi.mock('../../kubernetes/argo-application.js', () => ({
  ensureArgoApplication: vi.fn().mockResolvedValue('created'),
}));

vi.mock('../../kubernetes/kubernetes.service.js', () => ({
  kubernetesService: { getArgoStatus: vi.fn() },
}));

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mocks = {
  ensureNamespace: ensureNamespace as unknown as ReturnType<typeof vi.fn>,
  appsApi: appsApi as unknown as Record<string, ReturnType<typeof vi.fn>>,
  coreApi: coreApi as unknown as Record<string, ReturnType<typeof vi.fn>>,
  networkingApi: networkingApi as unknown as Record<string, ReturnType<typeof vi.fn>>,
  ensureArgoApplication: ensureArgoApplication as unknown as ReturnType<typeof vi.fn>,
  getArgoStatus: kubernetesService.getArgoStatus as unknown as ReturnType<typeof vi.fn>,
};

const NOT_FOUND = { code: 404 };

interface FixtureOpts {
  repositoryUrl?: string | null;
  config?: unknown;
  status?: string;
}

function makeDep(opts: FixtureOpts = {}) {
  return {
    id: 'dep-1',
    applicationId: 'app-1',
    environmentId: 'env-1',
    version: '1.0.0',
    commitSha: 'abc1234',
    status: opts.status ?? 'building',
    startedAt: new Date(),
    application: {
      id: 'app-1',
      name: 'podinfo-demo',
      repositoryUrl: opts.repositoryUrl ?? null,
      config: opts.config ?? {},
    },
    environment: {
      id: 'env-1',
      name: 'podinfo-demo-dev',
      type: 'dev',
      namespace: 'platform-podinfo-demo-dev',
    },
  };
}

/** Config Git valide : bascule en mode Argo (avec un dépôt). */
const GIT_CONFIG = { git: { branch: 'master', path: 'kustomize' } };
const REPO_URL = 'https://github.com/stefanprodan/podinfo.git';

const OWN_PLACEHOLDER_LABELS = {
  app: 'podinfo-demo',
  env: 'dev',
  'managed-by': 'kubernal-idp',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.deployment.update.mockResolvedValue({});
  mocks.ensureNamespace.mockResolvedValue(undefined);
  mocks.ensureArgoApplication.mockResolvedValue('created');
  // Par défaut : rien n'existe (404) et aucune Service dans le namespace.
  mocks.appsApi.readNamespacedDeployment.mockRejectedValue(NOT_FOUND);
  mocks.coreApi.readNamespacedService.mockRejectedValue(NOT_FOUND);
  mocks.coreApi.listNamespacedService.mockResolvedValue({ items: [] });
  mocks.coreApi.readNamespacedEndpoints.mockRejectedValue(NOT_FOUND);
  mocks.networkingApi.readNamespacedIngress.mockRejectedValue(NOT_FOUND);
  mocks.networkingApi.createNamespacedIngress.mockResolvedValue({});
  mocks.appsApi.createNamespacedDeployment.mockResolvedValue({});
  mocks.coreApi.createNamespacedService.mockResolvedValue({});
});

describe('resolveGitConfig / resolveDeploymentMode (sélection du mode)', () => {
  it('sans config.git → mode placeholder', () => {
    const dep = makeDep({ repositoryUrl: REPO_URL, config: {} });
    expect(resolveGitConfig(dep)).toBeNull();
    expect(resolveDeploymentMode(dep)).toBe('placeholder');
  });

  it("config.git.path vide → reste en placeholder (pas d'objet git exploitable)", () => {
    const dep = makeDep({ repositoryUrl: REPO_URL, config: { git: { path: '' } } });
    expect(resolveGitConfig(dep)).toBeNull();
    expect(resolveDeploymentMode(dep)).toBe('placeholder');
  });

  it("git sans branch → défaut 'main', git sans path → placeholder", () => {
    expect(resolveGitConfig(makeDep({ config: { git: { path: 'kustomize' } } }))).toEqual({
      branch: 'main',
      path: 'kustomize',
    });
    expect(resolveGitConfig(makeDep({ config: { git: { branch: 'master' } } }))).toBeNull();
  });

  it('config.git + repositoryUrl → mode argo', () => {
    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    expect(resolveGitConfig(dep)).toEqual({ branch: 'master', path: 'kustomize' });
    expect(resolveDeploymentMode(dep)).toBe('argo');
  });

  it('config.git sans repositoryUrl → placeholder (rien à synchroniser)', () => {
    const dep = makeDep({ repositoryUrl: null, config: GIT_CONFIG });
    expect(resolveDeploymentMode(dep)).toBe('placeholder');
  });

  it('config non objet → placeholder', () => {
    expect(resolveDeploymentMode(makeDep({ config: 'nope' }))).toBe('placeholder');
    expect(resolveDeploymentMode(makeDep({ config: { git: 'nope' } }))).toBe('placeholder');
  });
});

describe('ensureK8sResources — mode placeholder (inchangé)', () => {
  it('crée Deployment + Service + Ingress, jamais de CR Argo', async () => {
    const dep = makeDep();
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.ensureNamespace).toHaveBeenCalledWith('platform-podinfo-demo-dev', {
      'managed-by': 'kubernal-idp',
    });
    expect(mocks.appsApi.createNamespacedDeployment).toHaveBeenCalledTimes(1);
    expect(mocks.coreApi.createNamespacedService).toHaveBeenCalledTimes(1);
    expect(mocks.networkingApi.createNamespacedIngress).toHaveBeenCalledTimes(1);
    expect(mocks.ensureArgoApplication).not.toHaveBeenCalled();
    expect(mocks.appsApi.deleteNamespacedDeployment).not.toHaveBeenCalled();
  });

  it('le backend de Ingress est le Service <app>-<env> (port 80)', async () => {
    await deploymentExecutor.ensureK8sResources(makeDep());
    const body = mocks.networkingApi.createNamespacedIngress.mock.calls[0]?.[0]?.body as {
      spec: { rules: Array<{ http: { paths: Array<{ backend: { service: { name: string; port: { number: number } } } }> } }> };
    };
    const backend = body.spec.rules[0]!.http.paths[0]!.backend.service;
    expect(backend.name).toBe('podinfo-demo-dev');
    expect(backend.port.number).toBe(80);
  });
});

describe('ensureK8sResources — mode Argo', () => {
  it('crée la CR Application Argo CD et ne crée AUCUN workload placeholder', async () => {
    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.ensureArgoApplication).toHaveBeenCalledWith({
      name: 'podinfo-demo-dev',
      repoURL: REPO_URL,
      targetRevision: 'master',
      path: 'kustomize',
      namespace: 'platform-podinfo-demo-dev',
      labels: {
        'kubernal.io/application': 'podinfo-demo',
        'kubernal.io/environment': 'dev',
        'kubernal.io/deployment-id': 'dep-1',
      },
    });
    expect(mocks.appsApi.createNamespacedDeployment).not.toHaveBeenCalled();
    expect(mocks.coreApi.createNamespacedService).not.toHaveBeenCalled();
  });

  it('supprime le Deployment/Service placeholder appartenant à kubernal-idp', async () => {
    mocks.appsApi.readNamespacedDeployment.mockResolvedValue({
      metadata: { name: 'podinfo-demo-dev', labels: OWN_PLACEHOLDER_LABELS },
    });
    mocks.coreApi.readNamespacedService.mockResolvedValue({
      metadata: { name: 'podinfo-demo-dev', labels: OWN_PLACEHOLDER_LABELS },
    });
    mocks.appsApi.deleteNamespacedDeployment.mockResolvedValue({});
    mocks.coreApi.deleteNamespacedService.mockResolvedValue({});

    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.appsApi.deleteNamespacedDeployment).toHaveBeenCalledTimes(1);
    expect(mocks.coreApi.deleteNamespacedService).toHaveBeenCalledTimes(1);
  });

  it("ne supprime JAMAIS une ressource qui n'est pas la notre (Service d'Argo)", async () => {
    mocks.appsApi.readNamespacedDeployment.mockResolvedValue({
      metadata: { name: 'podinfo-demo-dev', labels: { app: 'podinfo-demo', env: 'dev' } },
    });
    mocks.coreApi.readNamespacedService.mockResolvedValue({
      metadata: { name: 'podinfo-demo-dev', labels: { app: 'podinfo-demo' } },
    });

    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.appsApi.deleteNamespacedDeployment).not.toHaveBeenCalled();
    expect(mocks.coreApi.deleteNamespacedService).not.toHaveBeenCalled();
  });

  it('reporte Ingress tant que aucun Service actif (aucun backend)', async () => {
    mocks.coreApi.listNamespacedService.mockResolvedValue({ items: [] });
    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await expect(deploymentExecutor.ensureK8sResources(dep)).resolves.toBe('created');
    expect(mocks.networkingApi.createNamespacedIngress).not.toHaveBeenCalled();
    expect(mocks.networkingApi.replaceNamespacedIngress).not.toHaveBeenCalled();
  });

  it('pointe la Ingress vers le Service réel d Argo dès qu il a des endpoints', async () => {
    mocks.coreApi.listNamespacedService.mockResolvedValue({
      items: [
        {
          metadata: { name: 'kubernetes' },
          spec: { type: 'ClusterIP', ports: [{ name: 'https', port: 443 }] },
        },
        {
          metadata: { name: 'podinfo' },
          spec: {
            type: 'ClusterIP',
            ports: [
              { name: 'http', port: 9898, protocol: 'TCP' },
              { name: 'grpc', port: 9999, protocol: 'TCP' },
            ],
          },
        },
      ],
    });
    mocks.coreApi.readNamespacedEndpoints.mockImplementation(
      async ({ name }: { name: string }) => ({
        subsets: name === 'podinfo' ? [{ addresses: [{ ip: '10.244.0.5' }] }] : [],
      }),
    );

    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.networkingApi.createNamespacedIngress).toHaveBeenCalledTimes(1);
    const body = mocks.networkingApi.createNamespacedIngress.mock.calls[0]?.[0]?.body as {
      spec: { rules: Array<{ http: { paths: Array<{ backend: { service: { name: string; port: { number: number } } } }> } }> };
    };
    const backend = body.spec.rules[0]!.http.paths[0]!.backend.service;
    expect(backend.name).toBe('podinfo');
    expect(backend.port.number).toBe(9898);
  });

  it('réécrit le backend d une Ingress existante (transition placeholder → argo)', async () => {
    mocks.coreApi.listNamespacedService.mockResolvedValue({
      items: [
        {
          metadata: { name: 'podinfo' },
          spec: { type: 'ClusterIP', ports: [{ name: 'http', port: 9898 }] },
        },
      ],
    });
    mocks.coreApi.readNamespacedEndpoints.mockResolvedValue({
      subsets: [{ addresses: [{ ip: '10.244.0.5' }] }],
    });
    mocks.networkingApi.readNamespacedIngress.mockResolvedValue({
      metadata: { name: 'podinfo-demo-dev', labels: OWN_PLACEHOLDER_LABELS },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            http: {
              paths: [
                {
                  path: '/podinfo-demo-dev(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: { name: 'podinfo-demo-dev', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      },
    });
    mocks.networkingApi.replaceNamespacedIngress.mockResolvedValue({});

    const dep = makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG });
    await deploymentExecutor.ensureK8sResources(dep);

    expect(mocks.networkingApi.createNamespacedIngress).not.toHaveBeenCalled();
    expect(mocks.networkingApi.replaceNamespacedIngress).toHaveBeenCalledTimes(1);
    const body = mocks.networkingApi.replaceNamespacedIngress.mock.calls[0]?.[0]?.body as {
      spec: {
        rules: Array<{
          http: { paths: Array<{ backend: { service: { name: string } } }> };
        }>;
      };
    };
    expect(body.spec.rules[0]!.http.paths[0]!.backend.service.name).toBe('podinfo');
  });
});

describe('reconcileStatus — mode Argo (statut piloté par la CR Application)', () => {
  const argoDep = (status: string) => makeDep({ repositoryUrl: REPO_URL, config: GIT_CONFIG, status });

  it('building → deploying (Argo ne pilote pas le Deployment K8s)', async () => {
    await deploymentExecutor.reconcileStatus(argoDep('building'));
    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: 'deploying' },
    });
    // La santé ne vient pas du Deployment K8s (lecture différée au cycle suivant)
    // et la CR Argo n'est interrogée qu'une fois en `deploying`.
    expect(mocks.getArgoStatus).not.toHaveBeenCalled();
  });

  it('Synced + Healthy → healthy', async () => {
    mocks.getArgoStatus.mockResolvedValue({ sync: 'Synced', health: 'Healthy' });
    await deploymentExecutor.reconcileStatus(argoDep('deploying'));
    expect(mocks.getArgoStatus).toHaveBeenCalledWith('podinfo-demo-dev');
    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
      data: { status: 'healthy', completedAt: expect.any(Date) },
    });
  });

  it('OutOfSync + Progressing → reste deploying (aucune écriture)', async () => {
    mocks.getArgoStatus.mockResolvedValue({ sync: 'OutOfSync', health: 'Progressing' });
    await deploymentExecutor.reconcileStatus(argoDep('deploying'));
    expect(mockDb.deployment.update).not.toHaveBeenCalled();
  });

  it('Degraded → failed', async () => {
    mocks.getArgoStatus.mockResolvedValue({
      sync: 'Synced',
      health: 'Degraded',
      message: 'pod crashed',
    });
    await deploymentExecutor.reconcileStatus(argoDep('deploying'));
    expect(mockDb.deployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it("erreur de parse du repo (status.error) → failed", async () => {
    mocks.getArgoStatus.mockResolvedValue({
      sync: 'OutOfSync',
      health: 'Unknown',
      error: true,
      message: 'failed to load path: kustomize',
    });
    await deploymentExecutor.reconcileStatus(argoDep('deploying'));
    expect(mockDb.deployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('CR absente (null) → reste deploying', async () => {
    mocks.getArgoStatus.mockResolvedValue(null);
    await deploymentExecutor.reconcileStatus(argoDep('deploying'));
    expect(mockDb.deployment.update).not.toHaveBeenCalled();
  });

  it('getArgoStatus en échec → reste deploying (pas de crash)', async () => {
    mocks.getArgoStatus.mockRejectedValue(new Error('apiserver down'));
    await expect(deploymentExecutor.reconcileStatus(argoDep('deploying'))).resolves.toBeUndefined();
    expect(mockDb.deployment.update).not.toHaveBeenCalled();
  });
});
