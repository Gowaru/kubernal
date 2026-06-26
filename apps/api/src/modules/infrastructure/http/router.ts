import { Router } from 'express';
import { userController } from '../../../modules/user/user.controller.js';
import { teamController } from '../../../modules/team/team.controller.js';
import { templateController } from '../../../modules/template/template.controller.js';
import { applicationController } from '../../../modules/application/application.controller.js';
import { environmentController } from '../../../modules/environment/environment.controller.js';
import { deploymentController } from '../../../modules/deployment/deployment.controller.js';
import { pipelineController } from '../../../modules/pipeline/pipeline.controller.js';
import { policyController } from '../../../modules/policy/policy.controller.js';
import { kubernetesController } from '../../../modules/kubernetes/kubernetes.controller.js';
import { webhookController } from '../../../modules/webhook/webhook.controller.js';
import { webhookOutboundController } from '../../../modules/webhook-outbound/webhook-outbound.controller.js';
import { auditController } from '../../../modules/audit/audit.controller.js';

import { validate } from '../../../shared/middleware/validate.js';
import { requireAuth, requireRole } from '../../../shared/middleware/auth.js';
import { createUserSchema, updateUserSchema } from '../../../modules/user/user.schema.js';
import { createTeamSchema, updateTeamSchema } from '../../../modules/team/team.schema.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
} from '../../../modules/template/template.schema.js';
import {
  createApplicationSchema,
  updateApplicationSchema,
} from '../../../modules/application/application.schema.js';
import {
  createEnvironmentSchema,
  updateEnvironmentSchema,
} from '../../../modules/environment/environment.schema.js';
import {
  createDeploymentSchema,
  transitionStatusSchema,
  approveDeploymentSchema,
  recordViolationsSchema,
  promoteDeploymentSchema,
  bumpVersionSchema,
} from '../../../modules/deployment/deployment.schema.js';
import {
  scaleDeploymentSchema,
  restartDeploymentSchema,
  execInPodSchema,
  syncArgoSchema,
  setAutoSyncSchema,
} from '../../../modules/kubernetes/kubernetes.schema.js';
import {
  createPipelineSchema,
  updatePipelineStatusSchema,
  createPipelineFromTemplateSchema,
} from '../../../modules/pipeline/pipeline.schema.js';
import { createPolicySchema, updatePolicySchema } from '../../../modules/policy/policy.schema.js';
import { createWebhookConfigSchema, updateWebhookConfigSchema } from '../../../modules/webhook-outbound/webhook-outbound.schema.js';

export function createRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'kubernal-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Users ──────────────────────────────────────────────────────────────
  router.get('/users', requireAuth(), userController.list);
  router.get('/users/:id', requireAuth(), userController.getById);
  router.post('/users', requireAuth(), requireRole('admin'), validate(createUserSchema), userController.create);
  router.patch('/users/:id', requireAuth(), requireRole('admin'), validate(updateUserSchema), userController.update);
  router.delete('/users/:id', requireAuth(), requireRole('admin'), userController.delete);

  // ─── Teams ──────────────────────────────────────────────────────────────
  router.get('/teams', requireAuth(), teamController.list);
  router.get('/teams/:id', requireAuth(), teamController.getById);
  router.post('/teams', requireAuth(), requireRole('platform_engineer'), validate(createTeamSchema), teamController.create);
  router.patch('/teams/:id', requireAuth(), requireRole('admin'), validate(updateTeamSchema), teamController.update);
  router.delete('/teams/:id', requireAuth(), requireRole('platform_engineer'), teamController.delete);

  // ─── Templates (Golden Path) ────────────────────────────────────────────
  router.get('/templates', requireAuth(), templateController.list);
  router.get('/templates/:id', requireAuth(), templateController.getById);
  router.post('/templates', requireAuth(), requireRole('platform_engineer'), validate(createTemplateSchema), templateController.create);
  router.patch('/templates/:id', requireAuth(), requireRole('platform_engineer'), validate(updateTemplateSchema), templateController.update);
  router.delete('/templates/:id', requireAuth(), requireRole('platform_engineer'), templateController.delete);

  // ─── Applications ───────────────────────────────────────────────────────
  router.get('/applications', requireAuth(), applicationController.list);
  router.get('/applications/:id', requireAuth(), applicationController.getById);
  router.post('/applications', requireAuth(), requireRole('developer'), validate(createApplicationSchema), applicationController.create);
  router.patch('/applications/:id', requireAuth(), requireRole('platform_engineer'), validate(updateApplicationSchema), applicationController.update);
  router.delete('/applications/:id', requireAuth(), requireRole('platform_engineer'), applicationController.delete);

  // ─── Environments ───────────────────────────────────────────────────────
  router.get('/environments', requireAuth(), environmentController.list);
  router.get('/environments/:id', requireAuth(), environmentController.getById);
  router.post('/environments', requireAuth(), requireRole('platform_engineer'), validate(createEnvironmentSchema), environmentController.create);
  router.patch('/environments/:id', requireAuth(), requireRole('platform_engineer'), validate(updateEnvironmentSchema), environmentController.update);
  router.delete('/environments/:id', requireAuth(), requireRole('platform_engineer'), environmentController.delete);

  // ─── Deployments ────────────────────────────────────────────────────────
  router.get('/deployments', requireAuth(), deploymentController.list);
  router.get('/deployments/compare', requireAuth(), deploymentController.compare);
  router.post('/deployments/next-version', requireAuth(), requireRole('developer'), validate(bumpVersionSchema), deploymentController.previewNextVersion);
  router.get('/deployments/:id', requireAuth(), deploymentController.getById);
  router.post('/deployments', requireAuth(), requireRole('developer'), validate(createDeploymentSchema), deploymentController.create);
  router.post('/deployments/:id/transition', requireAuth(), requireRole('platform_engineer'), validate(transitionStatusSchema), deploymentController.transitionStatus);
  router.post('/deployments/:id/approve', requireAuth(), requireRole('platform_engineer'), validate(approveDeploymentSchema), deploymentController.approve);
  router.post('/deployments/:id/promote', requireAuth(), requireRole('platform_engineer'), validate(promoteDeploymentSchema), deploymentController.promote);
  router.post('/deployments/:id/violations', requireAuth(), requireRole('developer'), validate(recordViolationsSchema), deploymentController.recordViolations);
  router.get('/deployments/:id/access', requireAuth(), kubernetesController.getDeploymentAccess);
  router.get('/deployments/:id/vulnerabilities', requireAuth(), deploymentController.getVulnerabilities);

  // ─── Pipelines ──────────────────────────────────────────────────────────
  router.get('/pipelines/worker/status', requireAuth(), pipelineController.workerStatus);
  router.get('/pipelines', requireAuth(), pipelineController.list);
  router.post('/pipelines/execute', requireAuth(), requireRole('platform_engineer'), validate(createPipelineFromTemplateSchema), pipelineController.executeFromTemplate);
  router.get('/pipelines/actions', requireAuth(), pipelineController.listAvailableActions);
  router.get('/pipelines/:id/events', requireAuth(), pipelineController.streamEvents);
  router.get('/pipelines/:id', requireAuth(), pipelineController.getById);
  router.get('/pipelines/:id/steps', requireAuth(), pipelineController.getSteps);
  router.get('/pipelines/:id/steps/:stepId', requireAuth(), pipelineController.getStepById);
  router.post('/pipelines', requireAuth(), requireRole('platform_engineer'), validate(createPipelineSchema), pipelineController.create);
  router.post('/pipelines/:id/status', requireAuth(), requireRole('platform_engineer'), validate(updatePipelineStatusSchema), pipelineController.updateStatus);

  // ─── Security Policies ──────────────────────────────────────────────────
  router.get('/policies', requireAuth(), policyController.list);
  router.get('/policies/:id', requireAuth(), policyController.getById);
  router.post('/policies', requireAuth(), requireRole('admin'), validate(createPolicySchema), policyController.create);
  router.patch('/policies/:id', requireAuth(), requireRole('admin'), validate(updatePolicySchema), policyController.update);
  router.delete('/policies/:id', requireAuth(), requireRole('admin'), policyController.delete);

  // ─── Kubernetes ─────────────────────────────────────────────────────────
  router.get('/kubernetes/pods', requireAuth(), kubernetesController.listPods);
  router.get('/kubernetes/services', requireAuth(), kubernetesController.listServices);
  router.get('/kubernetes/events', requireAuth(), kubernetesController.listEvents);
  router.get('/kubernetes/cluster', requireAuth(), kubernetesController.getClusterInfo);
  router.get('/kubernetes/argo', requireAuth(), kubernetesController.getArgoStatus);
  router.post('/kubernetes/argo/sync', requireAuth(), requireRole('developer'), validate(syncArgoSchema), kubernetesController.syncArgo);
  router.patch('/kubernetes/argo/auto-sync', requireAuth(), requireRole('platform_engineer'), validate(setAutoSyncSchema), kubernetesController.setAutoSync);
  router.get('/kubernetes/hpa', requireAuth(), kubernetesController.listHPA);
  router.get('/kubernetes/crossplane/claims', requireAuth(), kubernetesController.listClaims);
  router.get('/kubernetes/pods/:namespace/:name/logs', requireAuth(), kubernetesController.getPodLogs);
  router.patch('/kubernetes/deployments/:namespace/:name/scale', requireAuth(), requireRole('developer'), validate(scaleDeploymentSchema), kubernetesController.scaleDeployment);
  router.post('/kubernetes/deployments/:namespace/:name/restart', requireAuth(), requireRole('developer'), validate(restartDeploymentSchema), kubernetesController.restartDeployment);
  router.delete('/kubernetes/deployments/:namespace/:name', requireAuth(), requireRole('platform_engineer'), kubernetesController.deleteDeployment);
  router.post('/kubernetes/pods/:namespace/:name/exec', requireAuth(), requireRole('developer'), validate(execInPodSchema), kubernetesController.execInPod);

  // ─── Webhooks (incoming from GitHub/GitLab/Bitbucket) ─────────────────
  router.get('/applications/:appId/webhook', requireAuth(), webhookController.getConfig);
  router.post('/applications/:appId/webhook/regenerate', requireAuth(), requireRole('developer'), webhookController.regenerateSecret);
  router.post('/webhooks/:appId/:provider', webhookController.ingest);

  // ─── Webhooks Outbound ───────────────────────────────────────────────
  router.get('/applications/:applicationId/webhooks-outbound', requireAuth(), webhookOutboundController.listConfigs);
  router.get('/webhooks-outbound/:id', requireAuth(), webhookOutboundController.getConfig);
  router.post('/webhooks-outbound', requireAuth(), requireRole('developer'), validate(createWebhookConfigSchema), webhookOutboundController.createConfig);
  router.patch('/webhooks-outbound/:id', requireAuth(), requireRole('developer'), validate(updateWebhookConfigSchema), webhookOutboundController.updateConfig);
  router.delete('/webhooks-outbound/:id', requireAuth(), requireRole('developer'), webhookOutboundController.deleteConfig);
  router.post('/webhooks-outbound/:id/test', requireAuth(), requireRole('developer'), webhookOutboundController.testConfig);
  router.get('/webhooks-outbound/:configId/deliveries', requireAuth(), webhookOutboundController.listDeliveries);

  // ─── Audit Logs ─────────────────────────────────────────────────────
  router.get('/audit-logs', requireAuth(), requireRole('admin'), auditController.list);

  return router;
}