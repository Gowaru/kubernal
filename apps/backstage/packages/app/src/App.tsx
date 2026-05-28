import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import orgPlugin from '@backstage/plugin-org/alpha';
import apiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import catalogImportPlugin from '@backstage/plugin-catalog-import/alpha';
import catalogGraphPlugin from '@backstage/plugin-catalog-graph/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import authPlugin from '@backstage/plugin-auth';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import signalsPlugin from '@backstage/plugin-signals/alpha';
import { kubernalDeploymentsPlugin } from '@kubernal/backstage-plugin-deployments';
import { navModule } from './modules/nav';

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    searchPlugin,
    techdocsPlugin,
    kubernetesPlugin,
    orgPlugin,
    apiDocsPlugin,
    catalogImportPlugin,
    catalogGraphPlugin,
    userSettingsPlugin,
    authPlugin,
    notificationsPlugin,
    signalsPlugin,
    kubernalDeploymentsPlugin,
    navModule,
  ],
});
