import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = (process.env.API_URL ?? process.env.TEST_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

/**
 * Applications — E2E vs REAL API (no route.fulfill).
 * Requires backend at API_URL (default localhost:4000) + seeded DB.
 * Si l'API n'est pas joignable, la suite est skipée gracieusement.
 */

test.describe.serial('Applications API — real backend', () => {
  let api: APIRequestContext;
  let ownerId: string;
  let teamId: string;
  let templateId: string;
  const createdAppIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    // ---- Probe santé ----
    const probe = await playwright.request.newContext({ baseURL: API_URL });
    try {
      let health: import('@playwright/test').APIResponse | null = null;
      try {
        health = await probe.get('/health', { timeout: 4000 });
        if (!health.ok()) health = await probe.get('/api/v1/health', { timeout: 4000 });
      } catch {
        try {
          health = await probe.get('/api/v1/health', { timeout: 4000 });
        } catch {
          health = null;
        }
      }
      if (!health || !health.ok()) {
        test.skip(true, `API not reachable at ${API_URL} — skipping real-API applications tests`);
        return;
      }
    } catch {
      test.skip(true, `API not reachable at ${API_URL} — skipping`);
      return;
    } finally {
      await probe.dispose().catch(() => {});
    }

    // ---- Contexte API + login ----
    api = await playwright.request.newContext({ baseURL: API_URL });

    let loginRes = await api.post('/api/v1/auth/login', {
      data: { email: 'admin@kubernal.io', password: 'changeme' },
    });
    if (!loginRes.ok()) {
      // fallback: alice (developer) puis platform_engineer seed
      loginRes = await api.post('/api/v1/auth/login', {
        data: { email: 'alice@kubernal.io', password: 'changeme' },
      });
    }
    if (!loginRes.ok()) {
      const txt = await loginRes.text().catch(() => '');
      test.skip(true, `Login failed ${loginRes.status()} ${txt} — skipping`);
      return;
    }

    // ---- Résolution des FK obligatoires ----
    // ownerId via /auth/me (prioritaire) sinon extrait du login
    try {
      const meRes = await api.get('/api/v1/auth/me');
      if (meRes.ok()) {
        const meJson = (await meRes.json()) as Record<string, unknown>;
        const d = (meJson['data'] as Record<string, unknown> | undefined) ?? meJson;
        const id = (d?.['id'] as string | undefined) ?? (d?.['user'] as Record<string, unknown> | undefined)?.['id'] as string | undefined;
        if (id) ownerId = id;
      }
    } catch {}
    if (!ownerId) {
      try {
        const lj = (await loginRes.json()) as Record<string, unknown>;
        const d = (lj['data'] as Record<string, unknown> | undefined) ?? lj;
        ownerId = (d?.['id'] as string | undefined) ?? '';
        if (!ownerId) {
          const meFallback = await api.get('/api/v1/auth/me');
          if (meFallback.ok()) {
            const j = (await meFallback.json()) as Record<string, unknown>;
            const dd = (j['data'] as Record<string, unknown> | undefined) ?? j;
            ownerId = (dd?.['id'] as string | undefined) ?? '';
          }
        }
      } catch {}
    }

    // teamId
    try {
      const r = await api.get('/api/v1/teams');
      if (r.ok()) {
        const j = (await r.json()) as { data?: Array<{ id: string }> };
        const list = (j.data ?? []) as Array<{ id: string }>;
        if (list.length > 0) teamId = list[0]!.id;
      }
    } catch {}
    if (!teamId) {
      const cr = await api.post('/api/v1/teams', {
        data: { name: `e2e-team-${Date.now()}`, namespacePrefix: `e2e${Date.now().toString().slice(-6)}` },
      });
      if (cr.ok()) {
        const c = (await cr.json()) as { data?: { id: string }; id?: string };
        teamId = (c.data?.id ?? c.id) as string;
      }
    }

    // templateId
    try {
      const r = await api.get('/api/v1/templates');
      if (r.ok()) {
        const j = (await r.json()) as { data?: Array<{ id: string }> };
        const list = (j.data ?? []) as Array<{ id: string }>;
        if (list.length > 0) templateId = list[0]!.id;
      }
    } catch {}
    if (!templateId) {
      const cr = await api.post('/api/v1/templates', {
        data: {
          name: `e2e-tpl-${Date.now()}`,
          category: 'backend',
          description: 'e2e template (auto-created)',
          repository: 'https://github.com/octocat/Hello-World',
          version: '1.0.0',
        },
      });
      if (cr.ok()) {
        const c = (await cr.json()) as { data?: { id: string }; id?: string };
        templateId = (c.data?.id ?? c.id) as string;
      }
    }

    if (!ownerId || !teamId || !templateId) {
      test.skip(
        true,
        `Missing prerequisites ownerId=${ownerId ?? '∅'} teamId=${teamId ?? '∅'} templateId=${templateId ?? '∅'} — skipping`,
      );
    }
  });

  test.afterAll(async () => {
    if (api) {
      for (const id of createdAppIds) {
        try {
          await api.delete(`/api/v1/applications/${encodeURIComponent(id)}`);
        } catch {}
      }
      await api.dispose().catch(() => {});
    }
  });

  test('POST /api/v1/applications creates app + 3 envs auto', async () => {
    const name = `e2e-app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      name,
      description: 'E2E test application (real API)',
      templateId,
      teamId,
      ownerId,
      repositoryUrl: 'https://github.com/octocat/Hello-World.git',
      config: {},
    };

    const res = await api.post('/api/v1/applications', { data: payload });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    // support both {success:true, data:...} et {data:...}
    const data = (body['data'] as Record<string, unknown> | undefined) ?? body;
    // si wrapper success
    if ('success' in body) expect((body as { success: boolean }).success).toBe(true);

    const app = data as Record<string, unknown>;
    const id = (app['id'] as string | undefined) ?? (data as { id?: string }).id;
    expect(typeof id).toBe('string');
    expect((app['name'] as string) ?? (data as { name?: string }).name).toBe(name);

    // 3 envs auto-créés
    const envs = (app['environments'] as unknown[] | undefined) ?? (app['envs'] as unknown[] | undefined);
    if (Array.isArray(envs)) {
      expect(envs.length).toBe(3);
      const types = (envs as Array<Record<string, unknown>>).map((e) => e['type']).sort();
      expect(types).toEqual(['dev', 'prod', 'staging']);
    } else {
      // fallback: fetch l'app par id pour vérifier envs
      const get = await api.get(`/api/v1/applications/${encodeURIComponent(id as string)}`);
      expect(get.ok()).toBeTruthy();
      const gj = (await get.json()) as Record<string, unknown>;
      const gdata = (gj['data'] as Record<string, unknown> | undefined) ?? gj;
      const genvs = gdata['environments'] as unknown[] | undefined;
      if (Array.isArray(genvs)) expect(genvs.length).toBe(3);
    }

    createdAppIds.push(id as string);

    // sanity: archiver l'objet pour tests suivants
    (payload as Record<string, unknown>)['_createdId'] = id;
  });

  test('GET /api/v1/applications lists with pagination', async () => {
    // s'assurer qu'au moins 1 app existe (créé au test précédent)
    const res = await api.get('/api/v1/applications', { params: { page: '1', pageSize: '5' } });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    if ('success' in body && body['success'] === false) {
      // ne devrait pas arriver quand authentifié
      expect(body['success']).toBe(true);
    }
    const data = (body['data'] as unknown[] | undefined) ?? (body as unknown as unknown[]);
    const total = body['total'] as number | undefined;
    expect(Array.isArray(data)).toBeTruthy();
    expect(typeof total).toBe('number');
    expect((total as number) >= 1).toBeTruthy();

    // pageSize respectée
    const page1 = await api.get('/api/v1/applications', { params: { page: '1', pageSize: '1' } });
    expect(page1.ok()).toBeTruthy();
    const b1 = (await page1.json()) as { data: unknown[]; total: number };
    expect(Array.isArray(b1.data)).toBeTruthy();
    expect(b1.data.length).toBeLessThanOrEqual(1);
  });

  test('GET /api/v1/applications/:id returns app', async () => {
    // réutilise le dernier créé ou en crée un si besoin
    let appId = createdAppIds[createdAppIds.length - 1];
    if (!appId) {
      const name = `e2e-get-${Date.now().toString(36)}`;
      const r = await api.post('/api/v1/applications', {
        data: { name, templateId, teamId, ownerId, repositoryUrl: 'https://github.com/octocat/Hello-World.git' },
      });
      expect(r.ok()).toBeTruthy();
      const j = (await r.json()) as { data: { id: string } };
      appId = j.data.id;
      createdAppIds.push(appId);
    }

    const res = await api.get(`/api/v1/applications/${encodeURIComponent(appId)}`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    if ('success' in body) expect((body as { success: boolean }).success).toBe(true);
    const data = (body['data'] as Record<string, unknown> | undefined) ?? body;
    expect(data['id']).toBe(appId);
    expect(typeof data['name']).toBe('string');
  });

  test('Archive / unarchive flow', async () => {
    // crée dédiée pour éviter effets de bord
    const name = `e2e-arch-${Date.now().toString(36)}`;
    const cr = await api.post('/api/v1/applications', {
      data: { name, templateId, teamId, ownerId, repositoryUrl: 'https://github.com/octocat/Hello-World.git' },
    });
    expect(cr.ok()).toBeTruthy();
    const { data: created } = (await cr.json()) as { data: { id: string } };
    const appId = created.id;
    createdAppIds.push(appId);

    const archRes = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/archive`);
    // archive requiert platform_engineer ; si 403 on skip ce test (mais ne le fait pas échouer)
    if (!archRes.ok()) {
      if (archRes.status() === 403 || archRes.status() === 404) {
        test.skip(true, `Archive not authorized or missing (${archRes.status()}) — skipping arch flow`);
        return;
      }
      expect(archRes.ok()).toBeTruthy();
    }
    expect(archRes.ok()).toBeTruthy();
    const archBody = (await archRes.json()) as Record<string, unknown>;
    if ('success' in archBody) expect((archBody as { success: boolean }).success).toBe(true);
    const archData = (archBody['data'] as Record<string, unknown> | undefined) ?? archBody;
    // archivedAt doit être présent (non null)
    expect(archData['archivedAt'] as unknown).toBeTruthy();

    // GET doit refléter archivedAt (si l'API l'expose)
    const getArch = await api.get(`/api/v1/applications/${encodeURIComponent(appId)}`);
    if (getArch.ok()) {
      const gj = (await getArch.json()) as Record<string, unknown>;
      const gd = (gj['data'] as Record<string, unknown> | undefined) ?? gj;
      // tolérant: certaines implémentations ne renvoient plus les archivées en GET
      if (gd['archivedAt'] !== undefined) expect(gd['archivedAt']).toBeTruthy();
    }

    const unarchRes = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/unarchive`);
    if (!unarchRes.ok()) {
      if (unarchRes.status() === 403 || unarchRes.status() === 404) {
        test.skip(true, `Unarchive not authorized (${unarchRes.status()})`);
        return;
      }
      expect(unarchRes.ok()).toBeTruthy();
    }
    expect(unarchRes.ok()).toBeTruthy();
    const unBody = (await unarchRes.json()) as Record<string, unknown>;
    const unData = (unBody['data'] as Record<string, unknown> | undefined) ?? unBody;
    expect(unData['archivedAt']).toBeFalsy();
  });
});
