import { test, expect } from '@playwright/test';

const mockAdmin = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin@kubernal.io',
  name: 'Admin User',
  role: 'admin',
  teamId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockViewer = {
  ...mockAdmin,
  id: '44444444-4444-4444-4444-444444444444',
  email: 'viewer@kubernal.io',
  name: 'Viewer User',
  role: 'viewer',
};

async function mockAuth(page: import('@playwright/test').Page, user: typeof mockAdmin) {
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: user }),
    });
  });
}

async function mockAllApi(page: import('@playwright/test').Page, user: typeof mockAdmin) {
  await mockAuth(page, user);
  await page.route('**/api/pipelines/worker/status', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { running: false, total: 0 } }) });
  });
  await page.route('**/api/pipelines**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], total: 0, page: 1, pageSize: 10 }) });
  });
  await page.route('**/api/applications**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], total: 0, page: 1, pageSize: 10 }) });
  });
  await page.route('**/api/deployments**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], total: 0, page: 1, pageSize: 10 }) });
  });
  await page.route('**/api/teams**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/policies**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], total: 0 }) });
  });
  await page.route('**/api/events**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/k8s/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
}

test.describe('Auth flow', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      });
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated user lands on the app', async ({ page }) => {
    await mockAuth(page, mockAdmin);
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('OAuth callback redirects to login on failure', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
      });
    });
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login\?error=oidc_failed/);
  });
});

test.describe('RBAC - Sidebar visibility', () => {
  test('admin sees sidebar with navigation', async ({ page }) => {
    await mockAllApi(page, mockAdmin);
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 10000 });
  });

  test('viewer sees sidebar', async ({ page }) => {
    await mockAllApi(page, mockViewer);
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 10000 });
  });
});
