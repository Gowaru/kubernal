import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
} from "@backstage/core-plugin-api";
import { rootRouteRef } from "./routes.js";

export const kubernalDeploymentsPlugin = createPlugin({
  id: "kubernal-deployments",
  routes: {
    root: rootRouteRef,
  },
});

export const EntityKubernalDeploymentsCard =
  kubernalDeploymentsPlugin.provide(
    createComponentExtension({
      name: "EntityKubernalDeploymentsCard",
      component: {
        lazy: () =>
          import("./components/DeploymentsCard.js").then(
            (m) => m.DeploymentsCard,
          ),
      },
    }),
  );

export const KubernalDeploymentsPage = kubernalDeploymentsPlugin.provide(
  createRoutableExtension({
    name: "KubernalDeploymentsPage",
    component: () =>
      import("./components/DeploymentsPage.js").then((m) => m.DeploymentsPage),
    mountPoint: rootRouteRef,
  }),
);
