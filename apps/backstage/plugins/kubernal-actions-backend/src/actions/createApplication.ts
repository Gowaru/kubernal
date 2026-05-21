import { createTemplateAction } from "@backstage/plugin-scaffolder-node";

interface CreateApplicationActionOptions {
  apiBaseUrl: string;
}

export function createCreateApplicationAction(options: CreateApplicationActionOptions) {
  return createTemplateAction<{
    name: string;
    description?: string;
    owner: string;
    templateId?: string;
    teamId?: string;
  }>({
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

      // Resolve teamId from owner if needed
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
