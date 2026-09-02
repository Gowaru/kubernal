// =============================================================================
// Domain Types – Kubernal IDP
// =============================================================================

// --- User & Auth ---
export type UserRole = 'viewer' | 'developer' | 'platform_engineer' | 'admin' | 'security_admin';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  developer: 1,
  platform_engineer: 2,
  admin: 3,
  security_admin: 5,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  passwordHash?: string | null;
  oidcProvider?: string | null;
  oidcId?: string | null;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Team ---
export interface Team {
  id: string;
  name: string;
  description: string | null;
  quotaCpu: string;
  quotaMemory: string;
  namespacePrefix: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { applications: number };
}

// --- Template (Golden Path) ---
export type TemplateCategory = 'backend' | 'frontend' | 'fullstack' | 'library' | 'function';

export interface GoldenPathTemplate {
  id: string;
  name: string;
  version: string;
  category: TemplateCategory;
  description: string;
  repository: string;
  parameters: Record<string, unknown>;
  steps: TemplateStep[];
  createdAt: Date;
}

export interface TemplateStep {
  id: string;
  name: string;
  action: string;
  input: Record<string, unknown>;
}

// --- Application ---
export type ApplicationStatus = 'creating' | 'active' | 'failed' | 'archived';

export interface Application {
  id: string;
  name: string;
  description: string | null;
  templateId: string;
  teamId: string;
  ownerId: string;
  repositoryUrl: string | null;
  status: ApplicationStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  team?: Team;
  owner?: User;
  template?: GoldenPathTemplate;
}

// --- Environment ---
export type EnvironmentType = 'dev' | 'staging' | 'prod';

export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  applicationId: string;
  namespace: string;
  clusterName: string;
  requiresApproval: boolean;
  createdAt: Date;
}

// --- Deployment ---
export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'deploying'
  | 'healthy'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';
export type DeploymentTrigger = 'manual' | 'git_push' | 'scheduled' | 'rollback';

export interface Artifact {
  name: string;
  size: string;
  url?: string;
}

export interface Deployment {
  id: string;
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  approvedBy: User | null;
  artifacts: Artifact[];
  policyViolations: PolicyViolation[];
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  application?: Application;
  environment?: Environment;
}

// --- Pipeline ---
export type PipelineStatus = 'running' | 'success' | 'failed' | 'cancelled';

export interface Pipeline {
  id: string;
  deploymentId: string;
  name: string;
  status: PipelineStatus;
  stages: PipelineStage[];
  logsUrl: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: PipelineStatus;
  durationMs: number | null;
}

// --- Security & Compliance ---
export type PolicySeverity = 'critical' | 'high' | 'medium' | 'low';
export type PolicyCategory = 'security' | 'compliance' | 'cost' | 'operations';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  engine: 'kyverno' | 'opa' | 'custom';
  rules: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  severity: PolicySeverity;
  message: string;
  resource: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// --- Observability ---
export interface ObservabilityConfig {
  id: string;
  applicationId: string;
  teamId: string;
  dashboardUrl: string | null;
  alertsEnabled: boolean;
  logRetentionDays: number;
  tracingSampleRate: number;
  createdAt: Date;
}

export interface Metric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

// --- API Responses ---
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };

// --- K8s & Infrastructure ---
export type K8sPodPhase =
  | 'Running'
  | 'Pending'
  | 'Succeeded'
  | 'Failed'
  | 'CrashLoopBackOff'
  | 'Terminating'
  | 'Unknown';

export interface K8sContainerStatus {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: 'running' | 'waiting' | 'terminated';
  reason: string | null;
}

export interface K8sPod {
  id: string;
  name: string;
  namespace: string;
  nodeName: string;
  status: K8sPodPhase;
  ready: string;
  restarts: number;
  ip: string | null;
  age: string;
  startedAt: string | null;
  containers: K8sContainerStatus[];
  labels: Record<string, string>;
}

export interface K8sContainerResources {
  containerName: string;
  cpuRequest: string | null;
  cpuLimit: string | null;
  memoryRequest: string | null;
  memoryLimit: string | null;
  cpuUsage: string | null;
  memoryUsage: string | null;
}

export interface K8sHPAStatus {
  name: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  cpuTarget: number | null;
  cpuCurrent: number | null;
  memoryTarget: number | null;
  memoryCurrent: number | null;
}

export type CrossplaneClaimStatus = 'Ready' | 'Binding' | 'Provisioning' | 'Failed' | 'Deleting';

export type CrossplaneClaimKind = 'Postgres' | 'Redis' | 'Bucket' | 'Network' | 'Custom';

export interface CrossplaneClaim {
  id: string;
  name: string;
  kind: CrossplaneClaimKind;
  status: CrossplaneClaimStatus;
  class: string;
  namespace: string;
  message: string | null;
  boundAt: string | null;
  endpoint: string | null;
}

export type ArgoSyncStatus = 'Synced' | 'OutOfSync' | 'Unknown';

export type ArgoHealthStatus = 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Unknown';

export interface ArgoAppStatus {
  sync: ArgoSyncStatus;
  health: ArgoHealthStatus;
  revision: string;
  branch: string;
  lastSyncAt: string | null;
  message: string | null;
}

export type K8sEventType = 'Normal' | 'Warning';

export interface K8sEvent {
  id: string;
  involvedObject: string;
  reason: string;
  message: string;
  type: K8sEventType;
  count: number;
  lastTimestamp: string;
  source: string;
}

export interface K8sClusterContext {
  name: string;
  namespace: string;
  apiServerUrl: string;
  version: string;
  nodeCount: number;
}

export type K8sServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';

// --- Webhook Outbound ---
export type WebhookEvent =
  | 'started'
  | 'success'
  | 'failure'
  | 'rolled_back'
  | 'cancelled'
  | 'approval_needed';

export interface WebhookConfig {
  id: string;
  applicationId: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- Audit Log ---
export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogPaginatedResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WebhookDelivery {
  id: string;
  webhookConfigId: string;
  event: string;
  status: 'pending' | 'success' | 'failed';
  requestBody: Record<string, unknown> | null;
  responseStatus: number | null;
  responseBody: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: K8sServiceType;
  clusterIP: string;
  ports: { name: string; port: number; targetPort: number; protocol: string; nodePort?: number }[];
  selector: Record<string, string>;
  status: 'Active' | 'Pending';
  createdAt: string;
}

// ─── API Key ──────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  plainKey: string;
}
