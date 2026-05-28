import { test, expect } from '@playwright/test';

const BACKSTAGE_URL = 'https://backstage.kubernal.local:30443';

test('catalog API returns entities with guest auth', async ({ request }) => {
  // Get guest token
  const authRes = await request.post(`${BACKSTAGE_URL}/api/auth/guest/refresh`);
  expect(authRes.ok()).toBeTruthy();
  const { backstageIdentity } = await authRes.json();
  expect(backstageIdentity.token).toBeTruthy();

  // Query catalog
  const catRes = await request.get(`${BACKSTAGE_URL}/api/catalog/entities`, {
    headers: { Authorization: `Bearer ${backstageIdentity.token}` },
  });
  expect(catRes.ok()).toBeTruthy();
  const entities = await catRes.json();
  expect(entities.length).toBeGreaterThan(0);
  const names = entities.map(e => `${e.kind}:${e.metadata.name}`);
  expect(names).toContain('Component:kubernal-api');
  expect(names).toContain('Template:nodejs-backend-service');
  expect(names).toContain('API:kubernal-api');
});

test('scaffolder actions endpoint lists custom actions', async ({ request }) => {
  const authRes = await request.post(`${BACKSTAGE_URL}/api/auth/guest/refresh`);
  const { backstageIdentity } = await authRes.json();

  const actionsRes = await request.get(`${BACKSTAGE_URL}/api/scaffolder/v2/actions`, {
    headers: { Authorization: `Bearer ${backstageIdentity.token}` },
  });
  expect(actionsRes.ok()).toBeTruthy();
  const actions = await actionsRes.json();
  const actionIds = actions.map(a => a.id);
  expect(actionIds).toContain('kubernal:create-application');
  expect(actionIds).toContain('kubernal:create-environment');
  expect(actionIds).toContain('kubernal:create-deployment');
});

test('deployments plugin page loads', async ({ page }) => {
  // Sign in as guest first
  await page.goto(`${BACKSTAGE_URL}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click guest sign-in button
  const enterBtn = page.getByRole('button', { name: /enter/i });
  if (await enterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await enterBtn.click();
    await page.waitForTimeout(3000);
  }
  
  // Navigate to deployments page
  await page.goto(`${BACKSTAGE_URL}/kubernal-deployments`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const body = page.locator('body');
  await expect(body).not.toHaveText('404');
  await expect(body).not.toHaveText('Not Found');
});

test('kubernal API proxy returns health', async ({ request }) => {
  const authRes = await request.post(`${BACKSTAGE_URL}/api/auth/guest/refresh`);
  const { backstageIdentity } = await authRes.json();

  const proxyRes = await request.get(`${BACKSTAGE_URL}/api/proxy/kubernal/api/health`, {
    headers: { Authorization: `Bearer ${backstageIdentity.token}` },
  });
  expect(proxyRes.ok()).toBeTruthy();
  const data = await proxyRes.json();
  expect(data.status).toBe('ok');
});