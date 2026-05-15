// =============================================================================
// Domain Types – Kubernal IDP
// =============================================================================

// --- User & Auth ---
export type UserRole = 'developer' | 'platform_engineer' | 'security_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
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
  createdAt: Date;
  updatedAt: Date;
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

export interface Deployment {
  id: string;
  applicationId: string;
  environmentId: string;
  version: string;
  commitSha: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  approvedBy: string | null;
  artifacts: string[];
  policyViolations: PolicyViolation[];
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
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
