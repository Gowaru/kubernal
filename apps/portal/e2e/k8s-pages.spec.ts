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
  await page.route('**/api/kubernetes/**', (r) => jsonOk(r, []));
  await page.route('**/api/applications', (r) => jsonOk(r, []));
  await page.route('**/api/deployments', (r) => jsonOk(r, []));
  await page.route('**/api/environments', (r) => jsonOk(r, []));
  await page.route('**/api/templates', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines/**', (r) => jsonOk(r, []));
  await page.route('**/api/pipelines', (r) => jsonOk(r, []));
  await page.route('**/api/teams', (r) => jsonOk(r, []));
  await page.route('**/api/users', (r) => jsonOk(r, []));
  await page.route('**/api/api-keys', (r) => jsonOk(r, []));
  await page.route('**/api/policies', (r) => jsonOk(r, []));
}

test.describe('K8s Pods page', () => {
  test('loads and shows pods page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/k8s/pods');
    await expect(page.getByRole('heading', { name: 'Pods Kubernetes' })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('K8s Services page', () => {
  test('loads and shows services page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/k8s/services');
    await expect(page.getByRole('heading', { name: 'Services Kubernetes' })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('K8s Events page', () => {
  test('loads and shows events page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/k8s/events');
    await expect(page.getByRole('heading', { name: 'Événements Kubernetes' })).toBeVisible({
      timeout: 10000,
    });
  });
});
