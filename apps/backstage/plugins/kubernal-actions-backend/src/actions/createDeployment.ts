import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

interface CreateDeploymentActionOptions {
  apiBaseUrl: string;
}

export function createCreateDeploymentAction(options: CreateDeploymentActionOptions) {
  return createTemplateAction<{
    applicationId: string;
    environmentId: string;
    version: string;
    commitSha: string;
    trigger?: string;
  }>({
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
          trigger: {
            type: "string",
            title: "Trigger",
            enum: ["manual", "git_push", "scheduled", "rollback"],
          },
        },
      },
    },
    async handler(ctx) {
      const { applicationId, environmentId, version, commitSha, trigger } = ctx.input;

      ctx.logger.info(
        `Creating deployment v${version} for app ${applicationId} in env ${environmentId}`,
      );

      const response = await fetch(`${options.apiBaseUrl}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          environmentId,
          version,
          commitSha,
          trigger: trigger ?? "manual",
        }),
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
