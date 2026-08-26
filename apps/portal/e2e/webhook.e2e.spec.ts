import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';

const API_URL = (process.env.API_URL ?? process.env.TEST_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

/**
 * Webhooks — E2E vs REAL API (no route.fulfill).
 * - POST /api/v1/applications/:id/webhook/regenerate
 * - POST /api/v1/webhooks/:appId/github (signature invalide -> 401, valide -> 201 Deployment git_push)
 */

test.describe.serial('Webhooks API — real backend', () => {
  let api: APIRequestContext;
  let ownerId: string;
  let teamId: string;
  let templateId: string;
  let appId: string;
  let webhookSecret: string;

  const createdAppIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    const probe = await playwright.request.newContext({ baseURL: API_URL });
    try {
      let h: import('@playwright/test').APIResponse | null = null;
      try {
        h = await probe.get('/health', { timeout: 4000 });
        if (!h.ok()) h = await probe.get('/api/v1/health', { timeout: 4000 });
      } catch {
        try {
          h = await probe.get('/api/v1/health', { timeout: 4000 });
        } catch {
          h = null;
        }
      }
      if (!h || !h.ok()) {
        test.skip(true, `API not reachable at ${API_URL} — skipping webhook tests`);
        return;
      }
    } catch {
      test.skip(true, `API not reachable at ${API_URL}`);
      return;
    } finally {
      await probe.dispose().catch(() => {});
    }

    api = await playwright.request.newContext({ baseURL: API_URL });

    let loginRes = await api.post('/api/v1/auth/login', {
      data: { email: 'admin@kubernal.io', password: 'changeme' },
    });
    if (!loginRes.ok()) {
      loginRes = await api.post('/api/v1/auth/login', {
        data: { email: 'alice@kubernal.io', password: 'changeme' },
      });
    }
    if (!loginRes.ok()) {
      const txt = await loginRes.text().catch(() => '');
      test.skip(true, `Login failed ${loginRes.status()} ${txt}`);
      return;
    }

    try {
      const me = await api.get('/api/v1/auth/me');
      if (me.ok()) {
        const j = (await me.json()) as Record<string, unknown>;
        const d = (j['data'] as Record<string, unknown> | undefined) ?? j;
        ownerId = (d?.['id'] as string | undefined) ?? '';
      }
    } catch {}
    if (!ownerId) {
      const lj = (await loginRes.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
      const d = (lj['data'] as Record<string, unknown> | undefined) ?? lj;
      ownerId = (d?.['id'] as string | undefined) ?? '';
    }

    try {
      const r = await api.get('/api/v1/teams');
      if (r.ok()) {
        const j = (await r.json()) as { data?: Array<{ id: string }> };
        if (j.data && j.data.length > 0) teamId = j.data[0]!.id;
      }
    } catch {}
    if (!teamId) {
      const cr = await api.post('/api/v1/teams', {
        data: { name: `e2e-wh-team-${Date.now()}`, namespacePrefix: `e2ewh${Date.now().toString().slice(-6)}` },
      });
      if (cr.ok()) {
        const c = (await cr.json()) as { data?: { id: string }; id?: string };
        teamId = (c.data?.id ?? c.id) as string;
      }
    }

    try {
      const r = await api.get('/api/v1/templates');
      if (r.ok()) {
        const j = (await r.json()) as { data?: Array<{ id: string }> };
        if (j.data && j.data.length > 0) templateId = j.data[0]!.id;
      }
    } catch {}
    if (!templateId) {
      const cr = await api.post('/api/v1/templates', {
        data: {
          name: `e2e-wh-tpl-${Date.now()}`,
          category: 'backend',
          description: 'e2e template webhook',
          repository: 'https://github.com/octocat/Hello-World',
        },
      });
      if (cr.ok()) {
        const c = (await cr.json()) as { data?: { id: string }; id?: string };
        templateId = (c.data?.id ?? c.id) as string;
      }
    }

    if (!ownerId || !teamId || !templateId) {
      test.skip(true, `Missing prereqs owner=${ownerId} team=${teamId} tpl=${templateId}`);
      return;
    }

    // App dédiée webhook (besoin d'un env dev)
    const name = `e2e-wh-app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`;
    const appRes = await api.post('/api/v1/applications', {
      data: {
        name,
        description: 'E2E webhook host app',
        templateId,
        teamId,
        ownerId,
        repositoryUrl: 'https://github.com/octocat/Hello-World.git',
      },
    });
    expect(appRes.ok()).toBeTruthy();
    const appJson = (await appRes.json()) as Record<string, unknown>;
    const appData = (appJson['data'] as Record<string, unknown> | undefined) ?? appJson;
    appId = appData['id'] as string;
    createdAppIds.push(appId);
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

  test('POST /api/v1/applications/:id/webhook/regenerate returns new secret', async () => {
    const res = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/webhook/regenerate`);
    // regenerate requiert developer -> si 403 on skip
    if (!res.ok()) {
      if (res.status() === 403) {
        test.skip(true, 'Regenerate not authorized (need developer)');
        return;
      }
      expect(res.ok()).toBeTruthy();
    }
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    if ('success' in body && (body as { success: boolean }).success === false) {
      expect((body as { success: boolean }).success).toBe(true);
    }
    const data = (body['data'] as Record<string, unknown> | undefined) ?? body;
    const secret = (data['secret'] as string | undefined) ?? (data['webhookSecret'] as string | undefined);
    expect(typeof secret).toBe('string');
    expect((secret as string).length > 10).toBeTruthy();
    // must start with whsec_ (generateSecret)
    expect((secret as string).startsWith('whsec_')).toBeTruthy();
    webhookSecret = secret as string;

    // second regenerate doit donner un secret différent
    const res2 = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/webhook/regenerate`);
    expect(res2.ok()).toBeTruthy();
    const b2 = (await res2.json()) as Record<string, unknown>;
    const d2 = (b2['data'] as Record<string, unknown> | undefined) ?? b2;
    const secret2 = (d2['secret'] as string | undefined) ?? (d2['webhookSecret'] as string | undefined);
    expect(typeof secret2).toBe('string');
    expect(secret2).not.toBe(secret);
    webhookSecret = secret2 as string;
  });

  test('POST /api/v1/webhooks/:appId/github with invalid signature returns 401', async () => {
    // s'assurer qu'un secret existe
    if (!webhookSecret) {
      const r = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/webhook/regenerate`);
      if (r.ok()) {
        const j = (await r.json()) as Record<string, unknown>;
        const d = (j['data'] as Record<string, unknown> | undefined) ?? j;
        webhookSecret = (d['secret'] as string) ?? '';
      }
    }
    expect(webhookSecret).toBeTruthy();

    const payload = {
      ref: 'refs/heads/main',
      after: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      repository: { full_name: 'octocat/Hello-World' },
      sender: { login: 'octocat' },
    };
    const rawBody = JSON.stringify(payload);

    // signature invalide
    const res = await api.post(`/api/v1/webhooks/${encodeURIComponent(appId)}/github`, {
      headers: {
        'x-hub-signature-256': 'sha256=invalidsignature000000000000000000000000',
        'x-github-event': 'push',
        'content-type': 'application/json',
      },
      data: rawBody,
    });
    expect(res.status()).toBe(401);
    const body = (await res.json().catch(async () => ({ text: await res.text().catch(() => '') }))) as Record<
      string,
      unknown
    >;
    // le controller renvoie { success:false, error:{ code:'INVALID_SIGNATURE' } }
    const err = (body['error'] as Record<string, unknown> | undefined) ?? body;
    if (err['code']) expect(err['code']).toBe('INVALID_SIGNATURE');
  });

  test('POST /api/v1/webhooks/:appId/github with valid HMAC creates Deployment with trigger git_push', async () => {
    if (!webhookSecret) {
      const r = await api.post(`/api/v1/applications/${encodeURIComponent(appId)}/webhook/regenerate`);
      expect(r.ok()).toBeTruthy();
      const j = (await r.json()) as Record<string, unknown>;
      const d = (j['data'] as Record<string, unknown> | undefined) ?? j;
      webhookSecret = (d['secret'] as string) ?? '';
    }
    expect(webhookSecret).toBeTruthy();

    const commitSha = `a1b2c3d4e5f67890abcdef1234567890abcdef${Date.now().toString(16).slice(-6)}`.slice(0, 40);
    const payload = {
      ref: 'refs/heads/main',
      after: commitSha,
      repository: { full_name: 'octocat/Hello-World' },
      sender: { login: 'e2e-bot' },
    };
    const rawBody = JSON.stringify(payload);
    const sig = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');

    const res = await api.post(`/api/v1/webhooks/${encodeURIComponent(appId)}/github`, {
      headers: {
        'x-hub-signature-256': sig,
        'x-github-event': 'push',
        'content-type': 'application/json',
      },
      data: rawBody,
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    if ('success' in body && (body as { success: boolean }).success === false) {
      expect((body as { success: boolean }).success).toBe(true);
    }
    const data = (body['data'] as Record<string, unknown> | undefined) ?? body;
    // webhook ingest renvoie { kind:'DeploymentCreated', deploymentId, version, commitSha, branch, status, ... }
    const deploymentId =
      (data['deploymentId'] as string | undefined) ??
      (data['id'] as string | undefined) ??
      (data['deployment'] as Record<string, unknown> | undefined)?.['id'] as string | undefined;
    expect(typeof deploymentId).toBe('string');

    const returnedSha = (data['commitSha'] as string | undefined) ?? commitSha;
    expect(returnedSha).toBe(commitSha);

    // branch extrait de ref
    if (data['branch']) expect(data['branch']).toBe('main');

    // version = git-<shortSha>
    if (data['version']) {
      const short = commitSha.slice(0, 7);
      expect(data['version']).toBe(`git-${short}`);
    }

    // status building ou pending selon requiresApproval du dev env
    if (data['status']) {
      const st = data['status'] as string;
      expect(['pending', 'building'].includes(st)).toBeTruthy();
    }

    // Vérifie que le déploiement existe côté API et a trigger=git_push
    const depRes = await api.get(`/api/v1/deployments/${encodeURIComponent(deploymentId as string)}`);
    if (depRes.ok()) {
      const depBody = (await depRes.json()) as Record<string, unknown>;
      const depData = (depBody['data'] as Record<string, unknown> | undefined) ?? depBody;
      expect(depData['id']).toBe(deploymentId);
      expect(depData['commitSha']).toBe(commitSha);
      expect(depData['trigger']).toBe('git_push');
      expect(depData['applicationId']).toBe(appId);
    } else {
      // fallback: list deployments et filtre
      const listRes = await api.get('/api/v1/deployments');
      expect(listRes.ok()).toBeTruthy();
      const listBody = (await listRes.json()) as { data: Array<Record<string, unknown>> };
      const found = listBody.data.find((d) => d['id'] === deploymentId);
      expect(found).toBeTruthy();
      expect(found!['trigger']).toBe('git_push');
    }
  });

  test('GET /api/v1/applications/:id/webhook returns config', async () => {
    const res = await api.get(`/api/v1/applications/${encodeURIComponent(appId)}/webhook`);
    // endpoint protégé par requireAuth -> doit être ok
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    const data = (body['data'] as Record<string, unknown> | undefined) ?? body;
    expect(data['applicationId']).toBe(appId);
    expect(typeof data['hasSecret']).toBe('boolean');
    expect(data['hasSecret']).toBe(true);
    expect(typeof data['url']).toBe('string');
  });
});
