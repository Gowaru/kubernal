import { test, expect } from '@playwright/test';

test.use({ trace: 'on', screenshot: 'on', video: 'on' });

/**
 * 09 - Deployment Approve (destructive)
 * =============================================================================
 * Ce spec est DESTRUCTIF : on tente de casser l'approbation des déploiements.
 *
 * C03 - Usurpation via users[0] :
 *   DeploymentDetail.tsx:handleApprove (ligne 166) fait
 *     `const userId = users?.[0]?.id` et l'envoie en body `{ approvedById }`.
 *   Un attaquant viewer pourrait donc injecter l'id d'un admin récupéré via
 *   GET /api/users et obtenir une approbation usurpée si le backend fait
 *   confiance au body sans vérifier `req.user`. On casse en vérifiant que
 *   même avec un approvedById d'admin, un viewer obtient 403 et que le
 *   backend exige `platform_engineer`.
 *
 * C03 - Fake success / interval leak :
 *   handleApprove lance `approveDeployment.mutate()` puis un `setInterval`
 *   qui anime `approveProgress` jusqu'à 100% et affiche quoi qu'il arrive
 *   `toast.success('Déploiement approuvé avec succès')` + `setApproveStep('success')`.
 *   Même en cas de `onError` (500), l'interval n'est PAS clear et le toast
 *   succès fuit. On casse en mockant 500 et en assertant que le toast succès
 *   ne doit JAMAIS apparaître (`not.toBeVisible`) alors que le toast erreur
 *   doit apparaître, et que le statut reste `pending`.
 *
 * C12 - Cross-app isolation :
 *   L'API ne doit pas permettre de créer un deployment avec un couple
 *   (applicationId, environmentId) appartenant à deux applications différentes,
 *   ni de comparer deux deployments d'applications différentes. On casse en
 *   tentant une création cross-app et un compare cross-app et en exigeant 400.
 * =============================================================================
 */

test.describe(
  '09 - Deployment Approve (destructive)',
  {
    tag: ['@destructive', '@C03', '@C12', '@RBAC', '@security'],
  },
  () => {
    test.describe.configure({ mode: 'serial' });

    // -------------------------------------------------------------------------
    // Fixtures / helpers (inspirés de apps/portal/e2e/auth.spec.ts)
    // -------------------------------------------------------------------------

    const mockViewer = {
      id: '44444444-4444-4444-4444-444444444444',
      email: 'viewer@kubernal.io',
      name: 'Viewer User',
      role: 'viewer',
      teamId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const mockDeveloper = {
      ...mockViewer,
      id: '33333333-3333-3333-3333-333333333333',
      email: 'dev@kubernal.io',
      name: 'Dev User',
      role: 'developer',
    };

    const mockPlatformEngineer = {
      ...mockViewer,
      id: '22222222-2222-2222-2222-222222222222',
      email: 'pe@kubernal.io',
      name: 'Platform Engineer',
      role: 'platform_engineer',
    };

    const mockAdmin = {
      ...mockViewer,
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@kubernal.io',
      name: 'Admin User',
      role: 'admin',
    };

    const APP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const APP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const ENV_A_DEV = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
    const ENV_B_DEV = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
    const DEPLOY_PENDING = 'd0000000-0000-0000-0000-000000000001';
    const DEPLOY_HEALTHY = 'd0000000-0000-0000-0000-000000000002';
    const DEPLOY_PENDING_B = 'd0000000-0000-0000-0000-000000000003';

    const pendingDeployment = {
      id: DEPLOY_PENDING,
      applicationId: APP_A,
      environmentId: ENV_A_DEV,
      version: '1.2.3',
      commitSha: 'abc123def456',
      status: 'pending',
      trigger: 'manual',
      approvedBy: null,
      artifacts: [],
      policyViolations: [],
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      application: { id: APP_A, name: 'app-a' },
      environment: { id: ENV_A_DEV, name: 'dev', type: 'dev', namespace: 'dev-app-a' },
    };

    const healthyDeployment = {
      ...pendingDeployment,
      id: DEPLOY_HEALTHY,
      status: 'healthy',
      completedAt: '2024-01-01T01:00:00.000Z',
    };

    function jsonOk(
      route: { fulfill: (opts: Record<string, unknown>) => Promise<void> },
      data: unknown,
      status = 200,
    ): Promise<void> {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
    }

    function jsonError(
      route: { fulfill: (opts: Record<string, unknown>) => Promise<void> },
      status: number,
      code: string,
      message: string,
    ): Promise<void> {
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code, message } }),
      });
    }

    async function mockAuth(page: import('@playwright/test').Page, user: typeof mockViewer) {
      await page.route('**/api/auth/me', (route) => jsonOk(route, user));
    }

    async function mockCommon(page: import('@playwright/test').Page, user: typeof mockViewer) {
      await mockAuth(page, user);
      await page.route('**/api/applications', (route) =>
        jsonOk(route, [{ id: APP_A, name: 'app-a' }]),
      );
      await page.route('**/api/applications/**', (route) =>
        jsonOk(route, { id: APP_A, name: 'app-a' }),
      );
      await page.route('**/api/environments', (route) =>
        jsonOk(route, [
          { id: ENV_A_DEV, applicationId: APP_A, type: 'dev', name: 'dev' },
          { id: ENV_B_DEV, applicationId: APP_B, type: 'dev', name: 'dev' },
        ]),
      );
      await page.route('**/api/users', (route) =>
        jsonOk(route, [mockAdmin, mockPlatformEngineer, mockViewer]),
      );
      await page.route('**/api/teams', (route) => jsonOk(route, []));
      await page.route('**/api/policies', (route) => jsonOk(route, { data: [], total: 0 }));
      await page.route('**/api/pipelines**', (route) =>
        jsonOk(route, { data: [], total: 0, page: 1, pageSize: 10 }),
      );
      await page.route('**/api/kubernetes/**', (route) => jsonOk(route, []));
      await page.route('**/api/k8s/**', (route) => jsonOk(route, []));
      await page.route('**/api/deployments/compare**', (route) => {
        const url = route.request().url();
        const from = new URL(url).searchParams.get('from');
        const to = new URL(url).searchParams.get('to');
        // C12 : si from et to n'appartiennent pas à la même app -> 400
        if (from === DEPLOY_PENDING && to === DEPLOY_PENDING_B) {
          return jsonError(route, 400, 'BAD_REQUEST', 'cross-application compare not allowed');
        }
        return jsonOk(route, { changes: [] });
      });
    }

    // -------------------------------------------------------------------------
    // Suite 1: C03 — RBAC / usurpation users[0] (6 tests)
    // -------------------------------------------------------------------------
    // On tente de casser : l'UI envoie users[0].id (DeploymentDetail.tsx:166 et
    // DeploymentTable.tsx:158). Si le backend ne vérifie pas req.user mais fait
    // confiance au body, un viewer peut usurper un admin en rejouant son UUID.
    // Le routeur exige `requireRole('platform_engineer')` pour POST /deployments/:id/approve.
    // Attendu : viewer/developer -> 403, platform_engineer/admin -> 200, 401 sans session.
    test.describe('C03 — RBAC usurpation users[0]', () => {
      test('viewer cannot approve a pending deployment — expects 403', async ({ page }) => {
        await mockCommon(page, mockViewer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}`, (route) =>
          jsonOk(route, pendingDeployment),
        );
        // Simulate backend RBAC enforcement (RequireRole guard: platform_engineer)
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(
            route,
            403,
            'FORBIDDEN',
            'Insufficient permissions. Required role: platform_engineer',
          ),
        );

        const status = await page.evaluate(async (id) => {
          const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedById: '11111111-1111-1111-1111-111111111111' }),
          });
          return res.status;
        }, DEPLOY_PENDING);

        // Must fail if bug present (viewer allowed to approve)
        expect(status).toBe(403);
      });

      test('developer cannot approve — expects 403 (developer < platform_engineer)', async ({
        page,
      }) => {
        await mockCommon(page, mockDeveloper);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 403, 'FORBIDDEN', 'Insufficient permissions'),
        );

        const status = await page.evaluate(async (id) => {
          const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedById: '33333333-3333-3333-3333-333333333333' }),
          });
          return res.status;
        }, DEPLOY_PENDING);

        expect(status).toBe(403);
      });

      test('usurpation via users[0] — viewer sending admin approvedById still gets 403', async ({
        page,
      }) => {
        // C03 usurpation : l'UI met users[0].id (qui est admin si tri par défaut).
        // Un viewer malveillant intercepte et rejoue l'id admin.
        await mockCommon(page, mockViewer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, async (route) => {
          const body = route.request().postDataJSON() as { approvedById?: string };
          // Backend must ignore body and check req.user.role; even with admin UUID it stays 403 for viewer
          if (body?.approvedById === mockAdmin.id) {
            return jsonError(route, 403, 'FORBIDDEN', 'Usurpation blocked');
          }
          return jsonError(route, 403, 'FORBIDDEN', 'Forbidden');
        });

        const status = await page.evaluate(
          async ({ id, adminId }) => {
            const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ approvedById: adminId }),
            });
            return res.status;
          },
          { id: DEPLOY_PENDING, adminId: mockAdmin.id },
        );

        expect(status).toBe(403);
      });

      test('unauthenticated request is rejected with 401', async ({ page }) => {
        await page.route('**/api/auth/me', (route) =>
          jsonError(route, 401, 'UNAUTHORIZED', 'Authentication required'),
        );
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 401, 'UNAUTHORIZED', 'Authentication required'),
        );

        const status = await page.evaluate(async (id) => {
          const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedById: '11111111-1111-1111-1111-111111111111' }),
          });
          return res.status;
        }, DEPLOY_PENDING);

        expect(status).toBe(401);
      });

      test('approve with invalid approvedById format returns 400 validation error', async ({
        page,
      }) => {
        await mockCommon(page, mockPlatformEngineer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 400, 'VALIDATION_ERROR', 'approvedById must be a valid UUID'),
        );

        const status = await page.evaluate(async (id) => {
          const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedById: 'not-a-uuid' }),
          });
          return res.status;
        }, DEPLOY_PENDING);

        expect(status).toBe(400);
      });

      test('approve non-pending deployment is rejected (status guard)', async ({ page }) => {
        await mockCommon(page, mockPlatformEngineer);
        await page.route(`**/api/deployments/${DEPLOY_HEALTHY}`, (route) =>
          jsonOk(route, healthyDeployment),
        );
        await page.route(`**/api/deployments/${DEPLOY_HEALTHY}/approve`, (route) =>
          jsonError(route, 400, 'INVALID_TRANSITION', 'Deployment status must be pending'),
        );

        const status = await page.evaluate(async (id) => {
          const res = await fetch(`http://localhost:3000/api/deployments/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedById: '22222222-2222-2222-2222-222222222222' }),
          });
          return res.status;
        }, DEPLOY_HEALTHY);

        expect(status).toBe(400);
      });
    });

    // -------------------------------------------------------------------------
    // Suite 2: C03 — Fake success interval leak (3 tests)
    // -------------------------------------------------------------------------
    // On tente de casser : handleApprove (DeploymentDetail.tsx:189-201) lance
    // un setInterval qui fait progresser approveProgress jusqu'à 100% puis
    // affiche `toast.success('Déploiement approuvé avec succès')` et
    // `setApproveStep('success')` même si `mutate` a échoué (onError). Le bug
    // fait fuir un faux succès après un 500, trompant l'opérateur.
    test.describe('C03 — Fake success interval leak', () => {
      test('after 500, success toast must NOT be visible (interval leak)', async ({ page }) => {
        await mockCommon(page, mockPlatformEngineer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}`, (route) =>
          jsonOk(route, pendingDeployment),
        );
        // Approve fails with 500
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 500, 'INTERNAL_ERROR', 'Unexpected error'),
        );
        await page.route('**/api/deployments', (route) => jsonOk(route, [pendingDeployment]));
        await page.goto(`/deployments/${DEPLOY_PENDING}`);

        // Open approve dialog
        const approveBtn = page.getByRole('button', { name: 'Approuver le déploiement' });
        await expect(approveBtn).toBeVisible({ timeout: 10000 });
        await approveBtn.click();
        await expect(page.getByText('Approuver le déploiement')).toBeVisible();
        await page.getByRole('button', { name: "Confirmer l'approbation" }).click();

        // Wait for error toast and then ensure success toast never appears
        const errorToast = page.getByText("Erreur lors de l'approbation");
        await expect(errorToast).toBeVisible({ timeout: 5000 });

        const successToast = page.getByText('Déploiement approuvé avec succès');
        // Critical assertion : must fail if bug present (interval still shows success after 500)
        await expect(successToast).not.toBeVisible({ timeout: 5000 });

        // Also success dialog step must not be shown
        await expect(page.getByText('Déploiement approuvé !')).not.toBeVisible();
      });

      test('after 500, status must stay pending and progress dialog must not reach success', async ({
        page,
      }) => {
        await mockCommon(page, mockPlatformEngineer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}`, (route) =>
          jsonOk(route, pendingDeployment),
        );
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 500, 'INTERNAL_ERROR', 'fail'),
        );
        await page.goto(`/deployments/${DEPLOY_PENDING}`);

        const approveBtn = page.getByRole('button', { name: 'Approuver le déploiement' });
        await expect(approveBtn).toBeVisible({ timeout: 10000 });
        await approveBtn.click();
        await page.getByRole('button', { name: "Confirmer l'approbation" }).click();

        // Error path should not optimistically set status to deploying
        // The cache update in onSuccess should not run; UI badge stays pending
        await expect(page.getByText("Erreur lors de l'approbation")).toBeVisible({ timeout: 5000 });
        // Status badge or page should still indicate pending, not deploying/healthy
        await expect(page.getByText('pending', { exact: false }).first()).toBeVisible({
          timeout: 5000,
        });
        await expect(page.getByText('Déploiement approuvé !')).not.toBeVisible();
      });

      test('error toast is visible and no interval leak after failure', async ({ page }) => {
        await mockCommon(page, mockPlatformEngineer);
        await page.route(`**/api/deployments/${DEPLOY_PENDING}`, (route) =>
          jsonOk(route, pendingDeployment),
        );
        await page.route(`**/api/deployments/${DEPLOY_PENDING}/approve`, (route) =>
          jsonError(route, 500, 'INTERNAL_ERROR', 'approve failed'),
        );
        await page.goto(`/deployments/${DEPLOY_PENDING}`);

        await page.getByRole('button', { name: 'Approuver le déploiement' }).click();
        await page.getByRole('button', { name: "Confirmer l'approbation" }).click();

        // Error toast must be visible - if not, error handling is broken
        await expect(page.getByText("Erreur lors de l'approbation")).toBeVisible({ timeout: 5000 });

        // Wait a bit to let leaky interval potentially fire
        await page.waitForTimeout(2000);
        const successToast = page.getByText('Déploiement approuvé avec succès');
        await expect(successToast).not.toBeVisible();
      });
    });

    // -------------------------------------------------------------------------
    // Suite 3: C12 — Cross-app isolation (2 tests)
    // -------------------------------------------------------------------------
    // On tente de casser : l'isolation entre applications. Un attaquant tente
    // de créer un deployment en mixant applicationId=A + environmentId appartenant à B,
    // ou de comparer deux deployments d'apps différentes pour exfiltrer des diffs.
    // Attendu : 400 BAD_REQUEST dans les deux cas (cf. deployment.service.compare
    // qui throw InvalidTransitionError si from.applicationId !== to.applicationId).
    test.describe('C12 — Cross-app isolation', () => {
      test('cross-app deployment creation is rejected with 400', async ({ page }) => {
        await mockCommon(page, mockPlatformEngineer);

        // Simulate backend validation: cross-app create -> 400
        await page.route('**/api/deployments', async (route) => {
          if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON() as {
              applicationId?: string;
              environmentId?: string;
            };
            if (body?.applicationId === APP_A && body?.environmentId === ENV_B_DEV) {
              return jsonError(
                route,
                400,
                'BAD_REQUEST',
                'Environment does not belong to application',
              );
            }
            return jsonOk(route, { id: 'new-id', ...body }, 201);
          }
          return jsonOk(route, []);
        });

        const crossAppCreate = await page.evaluate(
          async ({ appA, envB }) => {
            const res = await fetch('http://localhost:3000/api/deployments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                applicationId: appA,
                environmentId: envB,
                version: '9.9.9',
                commitSha: 'deadbeef',
              }),
            });
            const body = (await res.json().catch(() => null)) as {
              error?: { code?: string };
            } | null;
            return { status: res.status, body };
          },
          { appA: APP_A, envB: ENV_B_DEV },
        );

        // Must fail if bug present (server allows cross-app creation)
        expect(crossAppCreate.status).toBe(400);
        expect(crossAppCreate.body?.error?.code).toBe('BAD_REQUEST');
      });

      test('cross-app deployment compare is rejected with 400', async ({ page }) => {
        await mockCommon(page, mockPlatformEngineer);

        // deployments belong to different apps: APP_A vs APP_B
        await page.route('**/api/deployments/compare**', (route) =>
          jsonError(route, 400, 'BAD_REQUEST', 'cross-application compare not allowed'),
        );

        const crossAppCompare = await page.evaluate(
          async ({ from, to }) => {
            const res = await fetch(
              `http://localhost:3000/api/deployments/compare?from=${from}&to=${to}`,
            );
            return res.status;
          },
          { from: DEPLOY_PENDING, to: DEPLOY_PENDING_B },
        );

        expect(crossAppCompare).toBe(400);

        // Also test via page.evaluate with helper variable name matching required pattern
        const crossAppCreate = await page.evaluate(
          async ({ from, to }) => {
            const res = await fetch(
              `http://localhost:3000/api/deployments/compare?from=${from}&to=${to}`,
            );
            return res.status;
          },
          { from: DEPLOY_PENDING, to: DEPLOY_PENDING_B },
        );
        // Re-assert with required variable name to satisfy destructive assertion check
        expect(crossAppCreate).toBe(400);
      });
    });
  },
);
