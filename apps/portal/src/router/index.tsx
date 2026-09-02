import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import PageLoader from '@/components/ui/page-loader';
import { ErrorFallback } from '@/components/ui/error-fallback';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Catalogue = lazy(() => import('@/pages/Catalogue'));
const AppDetail = lazy(() => import('@/pages/AppDetail'));
const Deployments = lazy(() => import('@/pages/Deployments'));
const DeploymentDetail = lazy(() => import('@/pages/DeploymentDetail'));
const Observability = lazy(() => import('@/pages/Observability'));
const Environments = lazy(() => import('@/pages/Environments'));
const Teams = lazy(() => import('@/pages/Teams'));
const Templates = lazy(() => import('@/pages/Templates'));
const Policies = lazy(() => import('@/pages/Policies'));
const Settings = lazy(() => import('@/pages/Settings'));
const K8sPodsPage = lazy(() => import('@/pages/k8s/K8sPodsPage'));
const K8sServicesPage = lazy(() => import('@/pages/k8s/K8sServicesPage'));
const K8sEventsPage = lazy(() => import('@/pages/k8s/K8sEventsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const LoginPage = lazy(() => import('@/pages/Login'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense fallback={<PageLoader />}>
        <AuthCallback />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorFallback />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            ),
          },
          {
            path: '/catalogue',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Catalogue />
              </Suspense>
            ),
          },
          {
            path: '/catalogue/:id',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AppDetail />
              </Suspense>
            ),
          },
          {
            path: '/deployments',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Deployments />
              </Suspense>
            ),
          },
          {
            path: '/deployments/:id',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DeploymentDetail />
              </Suspense>
            ),
          },
          {
            path: '/observability',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Observability />
              </Suspense>
            ),
          },
          {
            path: '/environments',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Environments />
              </Suspense>
            ),
          },
          {
            path: '/teams',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Teams />
              </Suspense>
            ),
          },
          {
            path: '/templates',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Templates />
              </Suspense>
            ),
          },
          {
            path: '/policies',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Policies />
              </Suspense>
            ),
          },
          {
            path: '/settings',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            ),
          },
          {
            path: '/k8s/pods',
            element: (
              <Suspense fallback={<PageLoader />}>
                <K8sPodsPage />
              </Suspense>
            ),
          },
          {
            path: '/k8s/services',
            element: (
              <Suspense fallback={<PageLoader />}>
                <K8sServicesPage />
              </Suspense>
            ),
          },
          {
            path: '/k8s/events',
            element: (
              <Suspense fallback={<PageLoader />}>
                <K8sEventsPage />
              </Suspense>
            ),
          },
          {
            path: '*',
            element: (
              <Suspense fallback={<PageLoader />}>
                <NotFound />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default router;
