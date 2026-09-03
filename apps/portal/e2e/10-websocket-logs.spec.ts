import { test, expect } from '@playwright/test';

/**
 * C02 — WebSocket logs : triple panne destructive
 *
 * 1. WS 404 (`apps/portal/src/hooks/usePodLogs.ts:105` vs `apps/api/src/shared/ws-log-server.ts:8`) :
 *    Le hook construit `ws://host/api/ws/kubernetes/pods/<ns>/<name>/logs` alors que le serveur
 *    n'écoute que sur `LOG_PATH_PREFIX = '/api/v1/ws/kubernetes/pods'` (`ws-log-server.ts:8`).
 *    En dev le proxy Vite `rewrite: p.replace(/^\/api/, '/api/v1')` masque le bug en réécrivant
 *    `/api/ws` → `/api/v1/ws`, mais en prod (sans Vite) le handshake renvoie 404 et aucun log
 *    n'arrive. Le fix est d'utiliser `/api/v1/ws/kubernetes/pods/...` côté client.
 *    Ce test échoue si `ws.url()` ne contient pas `/api/v1/ws`.
 *
 * 2. Fallback mort (`usePodLogs.ts:83 fallbackToPoll`) :
 *    `fallbackToPoll()` ne fait que `cleanupWs(); setTransport('poll')` sans jamais appeler
 *    `startPoll()`. Quand le WebSocket ferme (onclose/onerror/message type=error), le drawer
 *    passe en état `poll` mais n'émet aucune requête REST, donc plus aucun log n'est rafraîchi.
 *    Le fix est que `fallbackToPoll()` déclenche réellement le polling (ou appelle `startPoll()`).
 *    Ce test coupe le WS puis vérifie par `expect.poll(pollHits).toBeGreaterThan(1)` que le
 *    polling REST a bien lieu.
 *
 * 3. Conflit de préfixe (`/api/v1/ws` vs `/api/v1/kubernetes`) :
 *    Le router Express est monté sous `/api/v1` et expose `GET /api/v1/kubernetes/pods/:ns/:name/logs`
 *    en REST, tandis que le WS écoute `GET /api/v1/ws/kubernetes/pods/:ns/:name/logs` en upgrade.
 *    Le proxy Vite `rewrite: p.replace(/^\/api/, '/api/v1')` double le préfixe si le client
 *    utilise déjà `/api/v1/ws` → `/api/v1/v1/ws` (404). Inversement, si le client reste en
 *    `/api/ws`, le REST `/api/kubernetes/...` et le WS `/api/ws/...` ne partagent plus le même
 *    préfixe versionné et divergent entre dev/prod. Le fix est d'unifier sur `/api/v1` et de
 *    bypass le rewrite quand l'URL contient déjà `/api/v1/`. Ce test s'assure que le drawer
 *    affiche `WS` quand le handshake réussit et que le REST polling reste joignable en parallèle.
 */

const mockAdmin = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin@kubernal.io',
  name: 'Admin User',
  role: 'admin',
  teamId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockPod = {
  id: 'pod-1-uid',
  name: 'api-xyz-123',
  namespace: 'default',
  nodeName: 'node-1',
  status: 'Running',
  ready: '1/1',
  restarts: 0,
  ip: '10.0.0.1',
  age: '2h',
  startedAt: new Date().toISOString(),
  containers: [
    {
      name: 'api',
      image: 'kubernal/api:latest',
      ready: true,
      restartCount: 0,
      state: 'running' as const,
      reason: null,
    },
  ],
  labels: { app: 'api' },
};

const mockCluster = {
  name: 'kubernal-prod',
  namespace: 'default',
  apiServerUrl: 'https://k8s.example.com',
  version: 'v1.30.0',
  nodeCount: 3,
};

function jsonOk(
  route: { fulfill: (opts: Record<string, unknown>) => Promise<void> },
  data: unknown,
): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

test.use({ trace: 'on', screenshot: 'on', video: 'on' });

async function mockBaseApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/auth/me', (r) => jsonOk(r, mockAdmin));
  await page.route('**/api/kubernetes/pods', (r) => jsonOk(r, [mockPod]));
  // Also handle filtered/all-pods variant
  await page.route('**/api/kubernetes/pods?**', (r) => jsonOk(r, [mockPod]));
  await page.route('**/api/kubernetes/cluster', (r) => jsonOk(r, mockCluster));
  await page.route('**/api/kubernetes/services**', (r) => jsonOk(r, []));
  await page.route('**/api/kubernetes/events**', (r) => jsonOk(r, []));
  await page.route('**/api/kubernetes/hpa**', (r) => jsonOk(r, []));
  await page.route('**/api/kubernetes/argo**', (r) =>
    jsonOk(r, {
      sync: 'Synced',
      health: 'Healthy',
      revision: 'abc',
      branch: 'main',
      lastSyncAt: new Date().toISOString(),
      message: null,
    }),
  );
  await page.route('**/api/applications**', (r) => jsonOk(r, []));
  await page.route('**/api/deployments**', (r) => jsonOk(r, []));
  await page.route('**/api/environments**', (r) => jsonOk(r, []));
  await page.route('**/api/templates**', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines**', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines/**', (r) => jsonOk(r, []));
  await page.route('**/api/teams**', (r) => jsonOk(r, []));
  await page.route('**/api/users**', (r) => jsonOk(r, [mockAdmin]));
  await page.route('**/api/api-keys**', (r) => jsonOk(r, []));
  await page.route('**/api/policies**', (r) => jsonOk(r, []));
  await page.route('**/api/webhooks-outbound/**', (r) => jsonOk(r, []));
  await page.route('**/api/audit-logs**', (r) => jsonOk(r, []));
}

test.describe(
  'C02 - WebSocket pod logs (destructive)',
  {
    tag: ['@destructive', '@critical', '@C02'],
  },
  () => {
    test.describe.configure({ mode: 'serial' });

    test('WS URL doit pointer vers /api/v1/ws (échoue si bug 105)', async ({ page }) => {
      // Bug C02-1 : usePodLogs.ts:105 construit /api/ws/... alors que ws-log-server.ts:8 attend /api/v1/ws/...
      // Vite masque en dev (rewrite /api → /api/v1) mais prod renvoie 404. On intercepte le WebSocket
      // et on exige qu'il contienne le préfixe versionné.
      await mockBaseApis(page);

      // Mock REST logs to avoid noise (poll disabled when WS succeeds)
      await page.route('**/api/kubernetes/pods/**/logs**', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: '2024-01-01T00:00:00Z mock log line\n',
            lines: ['2024-01-01T00:00:00Z mock log line'],
            namespace: 'default',
            name: mockPod.name,
            container: null,
          }),
        }),
      );

      // Mock correct WS endpoint : only /api/v1/ws/... will be accepted, so a buggy /api/ws/... will 404
      await page.routeWebSocket('**/api/v1/ws/**', (ws) => {
        const server = ws.connectToServer();
        // Relay and inject a log line to make transport visible
        ws.onMessage((msg) => server.send(msg));
        server.onMessage((msg) => ws.send(msg));
        // Send a log frame shortly after connection to trigger UI update
        setTimeout(() => {
          try {
            ws.send(
              JSON.stringify({ type: 'log', line: '2024-01-01T00:00:00Z WS connected mock' }),
            );
          } catch {
            /* ignore */
          }
        }, 100);
      });

      const wsPromise = page.waitForEvent('websocket', (ws) => ws.url().includes('/logs'));

      await page.goto('/k8s/pods');
      await expect(page.getByRole('heading', { name: 'Pods Kubernetes' })).toBeVisible({
        timeout: 10000,
      });
      // Row is clickable → opens PodLogDrawer which mounts usePodLogs and creates WebSocket
      await expect(page.getByText(mockPod.name).first()).toBeVisible({ timeout: 10000 });
      await page.getByText(mockPod.name).first().click();

      // PodLogDrawer should appear
      await expect(page.getByText(mockPod.name).first()).toBeVisible({ timeout: 5000 });

      const ws = await wsPromise;
      // Assertion centralisante : échoue si le client utilise encore /api/ws sans /v1 (bug 105)
      expect(ws.url()).toContain('/api/v1/ws');
      expect(ws.url()).toContain('/kubernetes/pods/');
    });

    test('fallback polling doit s’activer quand le WS meurt (échoue si fallback mort)', async ({
      page,
    }) => {
      // Bug C02-2 : fallbackToPoll() (usePodLogs.ts:83) met seulement transport='poll' sans appeler
      // startPoll(), donc après onclose/onerror plus aucune requête GET /kubernetes/pods/.../logs n'est émise.
      // On coupe le WS et on compte les hits REST : doit être >1 grâce au setInterval 3s.
      await mockBaseApis(page);

      let pollHits = 0;
      await page.route('**/api/kubernetes/pods/**/logs**', async (route) => {
        pollHits += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: `2024-01-01T00:00:00Z poll hit ${pollHits}\n`,
            lines: [`2024-01-01T00:00:00Z poll hit ${pollHits}`],
            namespace: 'default',
            name: mockPod.name,
            container: null,
          }),
        });
      });

      // Force WS to fail immediately : any WS URL will be closed with error, triggering fallback
      await page.routeWebSocket('**/api/**', (ws) => {
        // Close the server side quickly to simulate 404 / network error
        ws.onMessage(() => {});
        setTimeout(() => {
          try {
            ws.close({ code: 1006, reason: 'simulated WS failure for fallback test' });
          } catch {
            /* ignore */
          }
        }, 200);
        // Also close the upstream
        try {
          const server = ws.connectToServer();
          server.close();
        } catch {
          /* ignore */
        }
      });

      await page.goto('/k8s/pods');
      await expect(page.getByRole('heading', { name: 'Pods Kubernetes' })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(mockPod.name).first()).toBeVisible({ timeout: 10000 });
      await page.getByText(mockPod.name).first().click();

      // Attendre un peu que le WS échoue et que le fallback s'enclenche ; usePodLogs poll toutes les 3s
      // On attend >1 hit : le premier fetch + au moins un interval
      await expect.poll(() => pollHits, { timeout: 12000 }).toBeGreaterThan(1);
    });

    test('conflit de préfixe : WS et REST coexistent, badge WS visible (échoue si préfixe en conflit)', async ({
      page,
    }) => {
      // Bug C02-3 : conflit de préfixe Vite `rewrite: p.replace(/^\/api/, '/api/v1')`.
      // Si le client utilise /api/v1/ws, Vite produit /api/v1/v1/ws (404). S'il garde /api/ws,
      // le REST /api/kubernetes/... (réécrit en /api/v1/kubernetes/...) et le WS divergent.
      // Le drawer PodLogDrawer.tsx affiche `WS` (Wifi) quand transport==='ws', `Poll` sinon.
      // Quand le préfixe est faux, le WS 404 et le badge reste en Poll/— ; ce test exige `WS`.
      await mockBaseApis(page);

      await page.route('**/api/kubernetes/pods/**/logs**', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: '2024-01-01T00:00:00Z rest log\n',
            lines: ['2024-01-01T00:00:00Z rest log'],
            namespace: 'default',
            name: mockPod.name,
            container: null,
          }),
        }),
      );

      // Mock seulement le bon préfixe versionné ; un client buggy (/api/ws) ne matchera pas et restera en Poll
      // Note: glob `?` = 1 caractère, donc on utilise une seule route `**/api/v1/ws/**` qui couvre aussi les qs
      await page.routeWebSocket('**/api/v1/ws/**', (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((m) => server.send(m));
        server.onMessage((m) => ws.send(m));
        setTimeout(() => {
          try {
            ws.send(JSON.stringify({ type: 'log', line: '2024-01-01T00:00:00Z WS prefix ok' }));
          } catch {
            /* ignore */
          }
        }, 100);
      });

      await page.goto('/k8s/pods');
      await expect(page.getByRole('heading', { name: 'Pods Kubernetes' })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(mockPod.name).first()).toBeVisible({ timeout: 10000 });
      await page.getByText(mockPod.name).first().click();

      // Le badge de transport dans PodLogDrawer.tsx (ligne 135) affiche "WS" uniquement si transport==='ws'
      // En cas de conflit de préfixe (404 WS), le WS tombe après ~1s (onclose → fallbackToPoll) et le badge
      // passe à "Poll" ou "—". On attend 2s pour laisser le fallback s'enclencher avant d'assert.
      await page.waitForTimeout(2000);
      await expect(page.getByText('WS')).toBeVisible({ timeout: 10000 });

      // Vérifie aussi que le flux WS a bien injecté une ligne (sanity : REST et WS ne se shadow pas)
      await expect(page.getByText(/WS prefix ok/)).toBeVisible({ timeout: 10000 });
    });
  },
);
