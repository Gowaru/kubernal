import { createBrowserRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import Dashboard from '@/pages/Dashboard';
import Catalogue from '@/pages/Catalogue';
import AppDetail from '@/pages/AppDetail';
import Deployments from '@/pages/Deployments';
import DeploymentDetail from '@/pages/DeploymentDetail';
import Observability from '@/pages/Observability';
import Environments from '@/pages/Environments';
import Teams from '@/pages/Teams';
import Templates from '@/pages/Templates';
import Policies from '@/pages/Policies';
import Settings from '@/pages/Settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell><Dashboard /></AppShell>,
  },
  {
    path: '/catalogue',
    element: <AppShell><Catalogue /></AppShell>,
  },
  {
    path: '/catalogue/:id',
    element: <AppShell><AppDetail /></AppShell>,
  },
  {
    path: '/deployments',
    element: <AppShell><Deployments /></AppShell>,
  },
  {
    path: '/deployments/:id',
    element: <AppShell><DeploymentDetail /></AppShell>,
  },
  {
    path: '/observability',
    element: <AppShell><Observability /></AppShell>,
  },
  {
    path: '/environments',
    element: <AppShell><Environments /></AppShell>,
  },
  {
    path: '/teams',
    element: <AppShell><Teams /></AppShell>,
  },
  {
    path: '/templates',
    element: <AppShell><Templates /></AppShell>,
  },
  {
    path: '/policies',
    element: <AppShell><Policies /></AppShell>,
  },
  {
    path: '/settings',
    element: <AppShell><Settings /></AppShell>,
  },
]);

export default router;
