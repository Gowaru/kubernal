import { coreServices, createBackendModule } from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node";
import { createCreateApplicationAction } from "./actions/createApplication";
import { createCreateEnvironmentAction } from "./actions/createEnvironment";
import { createCreateDeploymentAction } from "./actions/createDeployment";

const kubernalActionsModule = createBackendModule({
  pluginId: "scaffolder",
  moduleId: "kubernal-actions",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        const apiBaseUrl =
          config.getString("kubernal.api.baseUrl") ?? "http://localhost:4000/api/v1";

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
