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

import { validate } from '../../../shared/middleware/validate.js';
import { requireInternalApiKey } from '../../../shared/middleware/require-internal-api-key.js';
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
} from '../../../modules/kubernetes/kubernetes.schema.js';
import {
  createPipelineSchema,
  updatePipelineStatusSchema,
  createPipelineFromTemplateSchema,
} from '../../../modules/pipeline/pipeline.schema.js';
import { createPolicySchema, updatePolicySchema } from '../../../modules/policy/policy.schema.js';

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
  router.get('/users', userController.list);
  router.get('/users/:id', userController.getById);
  router.post('/users', validate(createUserSchema), userController.create);
  router.patch('/users/:id', validate(updateUserSchema), userController.update);
  router.delete('/users/:id', userController.delete);

  // ─── Teams ──────────────────────────────────────────────────────────────
  router.get('/teams', teamController.list);
  router.get('/teams/:id', teamController.getById);
  router.post('/teams', validate(createTeamSchema), teamController.create);
  router.patch('/teams/:id', validate(updateTeamSchema), teamController.update);
  router.delete('/teams/:id', teamController.delete);

  // ─── Templates (Golden Path) ────────────────────────────────────────────
  router.get('/templates', templateController.list);
  router.get('/templates/:id', templateController.getById);
  router.post('/templates', validate(createTemplateSchema), templateController.create);
  router.patch('/templates/:id', validate(updateTemplateSchema), templateController.update);
  router.delete('/templates/:id', templateController.delete);

  // ─── Applications ───────────────────────────────────────────────────────
  router.get('/applications', applicationController.list);
  router.get('/applications/:id', applicationController.getById);
  router.post('/applications', validate(createApplicationSchema), applicationController.create);
  router.patch(
    '/applications/:id',
    validate(updateApplicationSchema),
    applicationController.update,
  );
  router.delete('/applications/:id', applicationController.delete);

  // ─── Environments ───────────────────────────────────────────────────────
  router.get('/environments', environmentController.list);
  router.get('/environments/:id', environmentController.getById);
  router.post('/environments', validate(createEnvironmentSchema), environmentController.create);
  router.patch(
    '/environments/:id',
    validate(updateEnvironmentSchema),
    environmentController.update,
  );
  router.delete('/environments/:id', environmentController.delete);

  // ─── Deployments ────────────────────────────────────────────────────────
  router.get('/deployments', deploymentController.list);
  router.get('/deployments/compare', deploymentController.compare);
  router.post('/deployments/next-version', validate(bumpVersionSchema), deploymentController.previewNextVersion);
  router.get('/deployments/:id', deploymentController.getById);
  router.post('/deployments', validate(createDeploymentSchema), deploymentController.create);
  router.post(
    '/deployments/:id/transition',
    validate(transitionStatusSchema),
    deploymentController.transitionStatus,
  );
  router.post(
    '/deployments/:id/approve',
    validate(approveDeploymentSchema),
    deploymentController.approve,
  );
  router.post(
    '/deployments/:id/promote',
    validate(promoteDeploymentSchema),
    deploymentController.promote,
  );
  router.post(
    '/deployments/:id/violations',
    validate(recordViolationsSchema),
    deploymentController.recordViolations,
  );
  router.get('/deployments/:id/access', kubernetesController.getDeploymentAccess);
  router.get('/deployments/:id/vulnerabilities', deploymentController.getVulnerabilities);

  // ─── Pipelines ──────────────────────────────────────────────────────────
  router.get('/pipelines', pipelineController.list);
  router.post(
    '/pipelines/execute',
    validate(createPipelineFromTemplateSchema),
    pipelineController.executeFromTemplate,
  );
  router.get('/pipelines/actions', pipelineController.listAvailableActions);
  router.get('/pipelines/:id/events', pipelineController.streamEvents);
  router.get('/pipelines/:id', pipelineController.getById);
  router.get('/pipelines/:id/steps', pipelineController.getSteps);
  router.get('/pipelines/:id/steps/:stepId', pipelineController.getStepById);
  router.post('/pipelines', validate(createPipelineSchema), pipelineController.create);
  router.post(
    '/pipelines/:id/status',
    validate(updatePipelineStatusSchema),
    pipelineController.updateStatus,
  );

  // ─── Security Policies ──────────────────────────────────────────────────
  router.get('/policies', policyController.list);
  router.get('/policies/:id', policyController.getById);
  router.post('/policies', validate(createPolicySchema), policyController.create);
  router.patch('/policies/:id', validate(updatePolicySchema), policyController.update);
  router.delete('/policies/:id', policyController.delete);

  // ─── Kubernetes ─────────────────────────────────────────────────────────
  router.get('/kubernetes/pods', kubernetesController.listPods);
  router.get('/kubernetes/services', kubernetesController.listServices);
  router.get('/kubernetes/events', kubernetesController.listEvents);
  router.get('/kubernetes/cluster', kubernetesController.getClusterInfo);
  router.get('/kubernetes/argo', kubernetesController.getArgoStatus);
  router.get('/kubernetes/hpa', kubernetesController.listHPA);
  router.get('/kubernetes/crossplane/claims', kubernetesController.listClaims);
  router.get('/kubernetes/pods/:namespace/:name/logs', kubernetesController.getPodLogs);
  router.patch(
    '/kubernetes/deployments/:namespace/:name/scale',
    validate(scaleDeploymentSchema),
    kubernetesController.scaleDeployment,
  );
  router.post(
    '/kubernetes/deployments/:namespace/:name/restart',
    validate(restartDeploymentSchema),
    kubernetesController.restartDeployment,
  );
  router.delete('/kubernetes/deployments/:namespace/:name', kubernetesController.deleteDeployment);
  router.post(
    '/kubernetes/pods/:namespace/:name/exec',
    validate(execInPodSchema),
    kubernetesController.execInPod,
  );

  // ─── Webhooks (incoming from GitHub/GitLab/Bitbucket) ─────────────────
  router.get('/applications/:appId/webhook', webhookController.getConfig);
  router.post(
    '/applications/:appId/webhook/regenerate',
    requireInternalApiKey(),
    webhookController.regenerateSecret,
  );
  router.post('/webhooks/:appId/:provider', webhookController.ingest);

  return router;
}
