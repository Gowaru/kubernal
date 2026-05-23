import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
function createCreateApplicationAction(options) {
  return createTemplateAction({
    id: "kubernal:create-application",
    description: "Creates a new application in Kubernal IDP",
    schema: {
      input: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Application name" },
          description: { type: "string", title: "Description" },
          owner: { type: "string", title: "Owner" },
          templateId: { type: "string", title: "Template ID" },
          teamId: { type: "string", title: "Team ID" },
        },
      },
    },
    async handler(ctx) {
      const { name, description, owner, templateId } = ctx.input;
      ctx.logger.info(`Creating application '${name}' in Kubernal IDP`);
      const resolvedTeamId = ctx.input.teamId || "default";
      const response = await fetch(`${options.apiBaseUrl}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description ?? "",
          templateId: templateId ?? "00000000-0000-0000-0000-000000000000",
          teamId: resolvedTeamId,
          ownerId: owner,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create application: ${error}`);
      }
      const app = await response.json();
      ctx.output("applicationId", app.data.id);
      ctx.output("applicationName", app.data.name);
    },
  });
}
function createCreateEnvironmentAction(options) {
  return createTemplateAction({
    id: "kubernal:create-environment",
    description: "Creates an environment for an application in Kubernal IDP",
    schema: {
      input: {
        type: "object",
        required: ["applicationName", "environmentType", "namespace"],
        properties: {
          applicationName: { type: "string", title: "Application name" },
          environmentType: { type: "string", title: "Environment type", enum: ["dev", "staging", "prod"] },
          namespace: { type: "string", title: "Kubernetes namespace" },
          requiresApproval: { type: "boolean", title: "Requires approval" },
        },
      },
    },
    async handler(ctx) {
      const { applicationName, environmentType, namespace, requiresApproval } = ctx.input;
      ctx.logger.info(`Creating '${environmentType}' environment for '${applicationName}'`);
      const listResponse = await fetch(`${options.apiBaseUrl}/applications`);
      if (!listResponse.ok) throw new Error("Failed to list applications");
      const { data: apps } = await listResponse.json();
      const app = apps.find((a) => a.name === applicationName);
      if (!app) throw new Error(`Application '${applicationName}' not found`);
      const response = await fetch(`${options.apiBaseUrl}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: environmentType,
          type: environmentType,
          applicationId: app.id,
          namespace,
          requiresApproval: requiresApproval ?? environmentType === "prod",
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create environment: ${error}`);
      }
      const env = await response.json();
      ctx.output("environmentId", env.data.id);
    },
  });
}
function createCreateDeploymentAction(options) {
  return createTemplateAction({
    id: "kubernal:create-deployment",
    description: "Creates a new deployment in Kubernal IDP",
    schema: {
      input: {
        type: "object",
        required: ["applicationId", "environmentId", "version", "commitSha"],
        properties: {
          applicationId: { type: "string", title: "Application ID" },
          environmentId: { type: "string", title: "Environment ID" },
          version: { type: "string", title: "Version" },
          commitSha: { type: "string", title: "Commit SHA" },
          trigger: { type: "string", title: "Trigger", enum: ["manual", "git_push", "scheduled", "rollback"] },
        },
      },
    },
    async handler(ctx) {
      const { applicationId, environmentId, version, commitSha, trigger } = ctx.input;
      ctx.logger.info(`Creating deployment v${version} for app ${applicationId} in env ${environmentId}`);
      const response = await fetch(`${options.apiBaseUrl}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, environmentId, version, commitSha, trigger: trigger ?? "manual" }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create deployment: ${error}`);
      }
      const deployment = await response.json();
      ctx.output("deploymentId", deployment.data.id);
      ctx.output("deploymentStatus", deployment.data.status);
    },
  });
}
import { coreServices, createBackendModule } from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node";
const kubernalActionsModule = createBackendModule({
  pluginId: "scaffolder",
  moduleId: "kubernal-actions",
  register(env) {
    env.registerInit({
      deps: { scaffolder: scaffolderActionsExtensionPoint, config: coreServices.rootConfig },
      async init({ scaffolder, config }) {
        let apiBaseUrl = "http://kubernal-api:4000/api/v1";
        try {
          apiBaseUrl = config.getString("kubernal.api.baseUrl");
        } catch {};
        scaffolder.addActions(
          createCreateApplicationAction({ apiBaseUrl }),
          createCreateEnvironmentAction({ apiBaseUrl }),
          createCreateDeploymentAction({ apiBaseUrl }),
        );
      },
    });
  },
});
export default kubernalActionsModule;