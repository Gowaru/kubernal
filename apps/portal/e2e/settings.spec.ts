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

function jsonOk(route: { fulfill: (opts: Record<string, unknown>) => void }, data: unknown): void {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function mockAllApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/auth/me', (r) => jsonOk(r, mockAdmin));
  await page.route('**/api/auth/login', (r) => jsonOk(r, mockAdmin));
  await page.route('**/api/users', (r) => jsonOk(r, [mockAdmin]));
  await page.route('**/api/teams', (r) => jsonOk(r, []));
  await page.route('**/api/api-keys', (r) => jsonOk(r, []));
  await page.route('**/api/users/me/notification-preferences', (r) => jsonOk(r, []));
  await page.route('**/api/kubernetes/**', (r) => jsonOk(r, []));
  await page.route('**/api/applications', (r) => jsonOk(r, []));
  await page.route('**/api/deployments', (r) => jsonOk(r, []));
  await page.route('**/api/environments', (r) => jsonOk(r, []));
  await page.route('**/api/templates', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines/**', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines', (r) => jsonOk(r, []));
  await page.route('**/api/policies', (r) => jsonOk(r, []));
  await page.route('**/api/webhooks-outbound/**', (r) => jsonOk(r, []));
  await page.route('**/api/audit-logs', (r) => jsonOk(r, []));
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/settings');
  });

  test('loads and shows profile info', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Profil')).toBeVisible();
  });

  test('shows notification preferences', async ({ page }) => {
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Déploiements réussis')).toBeVisible();
    await expect(page.getByText('Échecs de déploiement')).toBeVisible();
  });

  test('shows API key section', async ({ page }) => {
    await expect(page.getByText('Accès API')).toBeVisible({ timeout: 10000 });
  });
});
