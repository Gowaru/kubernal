import {
  type RbacV1Subject,
  type V1PolicyRule,
  type V1ResourceQuota,
  type V1Role,
  type V1RoleBinding,
  type V1RoleRef,
  type V1ServiceAccount,
} from '@kubernetes/client-node';
import { coreApi, rbacApi } from '../../../shared/k8s-client.js';
import type { ActionContext, ActionResult, PipelineAction } from './types.js';

const DEPLOYER_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] as const;
const DEPLOYER_RESOURCES = [
  'pods',
  'services',
  'deployments',
  'configmaps',
  'secrets',
  'ingresses',
] as const;
const VALID_ENV_TYPES = ['dev', 'staging', 'prod'] as const;
type EnvType = (typeof VALID_ENV_TYPES)[number];

interface ProvisionInfrastructureParams {
  applicationName: string;
  environmentType: EnvType;
  teamNamespacePrefix: string;
  resourceQuota?: { cpu?: string; memory?: string };
  createRbac?: boolean;
}

function isEnvType(value: unknown): value is EnvType {
  return typeof value === 'string' && (VALID_ENV_TYPES as readonly string[]).includes(value);
}

function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`provision:infrastructure: params.${field} must be a non-empty string`);
  }
  return value;
}

function validateResourceQuota(value: unknown): { cpu?: string; memory?: string } {
  if (typeof value !== 'object' || value === null) {
    throw new Error('provision:infrastructure: params.resourceQuota must be an object');
  }
  const q = value as Record<string, unknown>;
  const out: { cpu?: string; memory?: string } = {};
  if (q['cpu'] !== undefined) out.cpu = validateString(q['cpu'], 'resourceQuota.cpu');
  if (q['memory'] !== undefined) out.memory = validateString(q['memory'], 'resourceQuota.memory');
  if (out.cpu === undefined && out.memory === undefined) {
    throw new Error(
      'provision:infrastructure: params.resourceQuota must define at least cpu or memory',
    );
  }
  return out;
}

function parseProvisionParams(raw: Record<string, unknown>): ProvisionInfrastructureParams {
  const applicationName = validateString(raw['applicationName'], 'applicationName');
  const envTypeRaw = raw['environmentType'];
  if (!isEnvType(envTypeRaw)) {
    throw new Error(
      `provision:infrastructure: params.environmentType must be one of ${VALID_ENV_TYPES.join(', ')}`,
    );
  }
  const teamNamespacePrefix = validateString(raw['teamNamespacePrefix'], 'teamNamespacePrefix');
  const resourceQuota =
    raw['resourceQuota'] !== undefined ? validateResourceQuota(raw['resourceQuota']) : undefined;
  const createRbac = raw['createRbac'] === undefined ? true : raw['createRbac'];
  if (typeof createRbac !== 'boolean') {
    throw new Error('provision:infrastructure: params.createRbac must be a boolean');
  }
  return {
    applicationName,
    environmentType: envTypeRaw,
    teamNamespacePrefix,
    ...(resourceQuota ? { resourceQuota } : {}),
    createRbac,
  };
}

function buildNamespaceName(prefix: string, appName: string, envType: string): string {
  const safeApp = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${safePrefix}-${safeApp}-${envType}`.slice(0, 63);
}

function isAlreadyExists(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e['code'] === 409) return true;
    if (e['statusCode'] === 409) return true;
    if (e['response'] && typeof e['response'] === 'object') {
      const r = e['response'] as Record<string, unknown>;
      if (r['statusCode'] === 409) return true;
    }
  }
  return false;
}

function isNotFound(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e['code'] === 404) return true;
    if (e['statusCode'] === 404) return true;
  }
  return false;
}

async function ensureNamespaceExists(
  namespace: string,
  labels: Record<string, string>,
  logger: ActionContext['logger'],
): Promise<void> {
  try {
    await coreApi.readNamespace({ name: namespace });
    logger.info(`Namespace '${namespace}' already exists, skipping create`);
  } catch (err: unknown) {
    if (!isNotFound(err)) throw err;
    try {
      await coreApi.createNamespace({
        body: {
          metadata: {
            name: namespace,
            labels,
          },
        },
      });
      logger.info(`Namespace '${namespace}' created`);
    } catch (createErr: unknown) {
      if (!isAlreadyExists(createErr)) throw createErr;
      logger.info(`Namespace '${namespace}' created concurrently, skipping`);
    }
  }
}

async function createNamespacedIfMissing<T>(
  create: () => Promise<T>,
  resourceKind: string,
  resourceName: string,
  namespace: string,
  logger: ActionContext['logger'],
): Promise<void> {
  try {
    await create();
    logger.info(`${resourceKind} '${resourceName}' created in namespace '${namespace}'`);
  } catch (err: unknown) {
    if (isAlreadyExists(err)) {
      logger.info(
        `${resourceKind} '${resourceName}' already exists in namespace '${namespace}', skipping`,
      );
      return;
    }
    throw err;
  }
}

function buildServiceAccount(name: string, namespace: string): V1ServiceAccount {
  return {
    metadata: { name, namespace },
  };
}

function buildDeployerRole(name: string, namespace: string): V1Role {
  const rule: V1PolicyRule = {
    apiGroups: ['', 'apps'],
    resources: [...DEPLOYER_RESOURCES],
    verbs: [...DEPLOYER_VERBS],
  };
  return {
    metadata: { name, namespace },
    rules: [rule],
  };
}

function buildDeployerRoleBinding(
  name: string,
  namespace: string,
  roleName: string,
  saName: string,
): V1RoleBinding {
  const roleRef: V1RoleRef = {
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'Role',
    name: roleName,
  };
  const subject: RbacV1Subject = {
    kind: 'ServiceAccount',
    name: saName,
    namespace,
  };
  return {
    metadata: { name, namespace },
    roleRef,
    subjects: [subject],
  };
}

function buildResourceQuota(
  name: string,
  namespace: string,
  cpu: string | undefined,
  memory: string | undefined,
): V1ResourceQuota {
  const hard: Record<string, string> = {
    persistentvolumeclaims: '10',
    'count/deployments.apps': '50',
    'count/services': '50',
  };
  if (cpu) {
    hard['requests.cpu'] = cpu;
    hard['limits.cpu'] = cpu;
  }
  if (memory) {
    hard['requests.memory'] = memory;
    hard['limits.memory'] = memory;
  }
  return {
    metadata: { name, namespace },
    spec: { hard },
  };
}

async function tryCreateRbac(
  namespace: string,
  saName: string,
  roleName: string,
  bindingName: string,
  appName: string,
  logger: ActionContext['logger'],
): Promise<{ ok: boolean }> {
  try {
    await createNamespacedIfMissing(
      () =>
        coreApi.createNamespacedServiceAccount({
          namespace,
          body: buildServiceAccount(saName, namespace),
        }),
      'ServiceAccount',
      saName,
      namespace,
      logger,
    );
    await createNamespacedIfMissing(
      () =>
        rbacApi.createNamespacedRole({
          namespace,
          body: buildDeployerRole(roleName, namespace),
        }),
      'Role',
      roleName,
      namespace,
      logger,
    );
    await createNamespacedIfMissing(
      () =>
        rbacApi.createNamespacedRoleBinding({
          namespace,
          body: buildDeployerRoleBinding(bindingName, namespace, roleName, saName),
        }),
      'RoleBinding',
      bindingName,
      namespace,
      logger,
    );
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`RBAC creation for '${appName}' in '${namespace}' failed (non-fatal): ${message}`);
    return { ok: false };
  }
}

async function tryCreateResourceQuota(
  namespace: string,
  quotaName: string,
  cpu: string | undefined,
  memory: string | undefined,
  logger: ActionContext['logger'],
): Promise<void> {
  try {
    await createNamespacedIfMissing(
      () =>
        coreApi.createNamespacedResourceQuota({
          namespace,
          body: buildResourceQuota(quotaName, namespace, cpu, memory),
        }),
      'ResourceQuota',
      quotaName,
      namespace,
      logger,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`ResourceQuota creation in '${namespace}' failed (non-fatal): ${message}`);
  }
}

export const provisionInfrastructureAction: PipelineAction = {
  name: 'provision:infrastructure',
  validate(params) {
    parseProvisionParams(params);
  },
  async execute(context: ActionContext): Promise<ActionResult> {
    const params = parseProvisionParams(context.stepParams);
    const namespace = buildNamespaceName(
      params.teamNamespacePrefix,
      params.applicationName,
      params.environmentType,
    );
    const safeApp = params.applicationName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const labels: Record<string, string> = {
      'kubernal.io/managed-by': 'kubernal',
      'kubernal.io/application': safeApp,
      'kubernal.io/environment': params.environmentType,
      'kubernal.io/team-prefix': params.teamNamespacePrefix.toLowerCase(),
    };

    context.logger.info(`Provisioning namespace '${namespace}'`);
    await ensureNamespaceExists(namespace, labels, context.logger);

    const saName = `${safeApp}-deployer`;
    const roleName = `${safeApp}-deployer-role`;
    const bindingName = `${safeApp}-deployer-binding`;
    let rbacOk = false;
    if (params.createRbac) {
      context.logger.info(`Provisioning RBAC (SA + Role + RoleBinding) in '${namespace}'`);
      rbacOk = (
        await tryCreateRbac(namespace, saName, roleName, bindingName, safeApp, context.logger)
      ).ok;
    }

    let quotaCpu: string | undefined;
    let quotaMemory: string | undefined;
    if (params.resourceQuota) {
      quotaCpu = params.resourceQuota.cpu;
      quotaMemory = params.resourceQuota.memory;
      const quotaName = `${safeApp}-quota`;
      context.logger.info(`Provisioning ResourceQuota '${quotaName}' in '${namespace}'`);
      await tryCreateResourceQuota(namespace, quotaName, quotaCpu, quotaMemory, context.logger);
    }

    context.logger.info(
      `Provision done for '${namespace}' (rbac=${rbacOk ? 'created' : 'skipped/failed'})`,
    );

    return {
      output: {
        namespace,
        saName,
        roleName,
        bindingName,
        rbacCreated: rbacOk,
        quotaCpu: quotaCpu ?? null,
        quotaMemory: quotaMemory ?? null,
      },
      artifacts: [{ name: 'namespace', url: `kubernetes://namespaces/${namespace}` }],
    };
  },
};
