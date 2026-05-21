import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

interface CreateEnvironmentActionOptions {
  apiBaseUrl: string;
}

export function createCreateEnvironmentAction(options: CreateEnvironmentActionOptions) {
  return createTemplateAction<{
    applicationName: string;
    environmentType: string;
    namespace: string;
    requiresApproval?: boolean;
  }>({
    id: "kubernal:create-environment",
    description: "Creates an environment for an application in Kubernal IDP",
    schema: {
      input: {
        type: "object",
        required: ["applicationName", "environmentType", "namespace"],
        properties: {
          applicationName: { type: "string", title: "Application name" },
          environmentType: {
            type: "string",
            title: "Environment type",
            enum: ["dev", "staging", "prod"],
          },
          namespace: { type: "string", title: "Kubernetes namespace" },
          requiresApproval: { type: "boolean", title: "Requires approval" },
        },
      },
    },
    async handler(ctx) {
      const { applicationName, environmentType, namespace, requiresApproval } = ctx.input;

      ctx.logger.info(
        `Creating '${environmentType}' environment for '${applicationName}'`,
      );

      // Fetch application by name to get its ID
      const listResponse = await fetch(`${options.apiBaseUrl}/applications`);
      if (!listResponse.ok) throw new Error("Failed to list applications");

      const { data: apps } = await listResponse.json();
      const app = apps.find(
        (a: { name: string; id: string }) => a.name === applicationName,
      );

      if (!app) throw new Error(`Application '${applicationName}' not found`);

      // Create the environment
      const response = await fetch(`${options.apiBaseUrl}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: environmentType,
          type: environmentType,
          applicationId: app.id,
          namespace,
          requiresApproval:
            requiresApproval ?? environmentType === "prod",
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
