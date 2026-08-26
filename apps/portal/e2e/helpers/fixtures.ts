import type { Page } from '@playwright/test';

export type UserRole = 'admin' | 'developer' | 'viewer' | 'platform_engineer';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE_DATE = '2024-01-01T00:00:00.000Z';

const USERS_BY_ROLE: Record<UserRole, MockUser> = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@kubernal.io',
    name: 'Admin User',
    role: 'admin',
    teamId: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  },
  developer: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'dev@kubernal.io',
    name: 'Dev User',
    role: 'developer',
    teamId: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  },
  viewer: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'viewer@kubernal.io',
    name: 'Viewer User',
    role: 'viewer',
    teamId: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  },
  platform_engineer: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'pe@kubernal.io',
    name: 'PE User',
    role: 'platform_engineer',
    teamId: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
  },
};

/**
 * Returns a mock user object for the given role.
 * Accepts both `platform_engineer` (DB enum) and `platformEngineer` (camelCase) for convenience.
 */
export function mockUser(role: UserRole | 'platformEngineer'): MockUser {
  const normalized = role === 'platformEngineer' ? 'platform_engineer' : role;
  const user = USERS_BY_ROLE[normalized as UserRole];
  if (!user) {
    throw new Error(`Unknown role: ${role}. Expected one of admin/developer/viewer/platform_engineer`);
  }
  return { ...user };
}

export const TEST_USERS = {
  admin: USERS_BY_ROLE.admin,
  developer: USERS_BY_ROLE.developer,
  viewer: USERS_BY_ROLE.viewer,
  platformEngineer: USERS_BY_ROLE.platform_engineer,
} as const;

export function jsonOk(data: unknown): { status: number; contentType: string; body: string } {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  };
}

function errorCodeForStatus(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400) return 'BAD_REQUEST';
  if (status === 422) return 'VALIDATION_ERROR';
  return 'ERROR';
}

export function jsonError(
  status: number,
  message: string,
): { status: number; contentType: string; body: string } {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      error: { code: errorCodeForStatus(status), message },
    }),
  };
}

export async function mockAuth(page: Page, user: MockUser): Promise<void> {
  await page.route('**/api/auth/me', (route) => route.fulfill(jsonOk(user)));
}

/**
 * Mocks all common API endpoints used across portal pages.
 * Covers the required set:
 * - /api/pipelines/worker/status
 * - /api/pipelines**
 * - /api/applications**
 * - /api/deployments**
 * - /api/teams**
 * - /api/policies**
 * - /api/events**
 * - /api/k8s/**
 * plus auth and a superset of legacy endpoints (kubernetes, environments, templates, users, etc.)
 * to keep existing specs green after migration.
 */
export async function mockAllApis(page: Page, user: MockUser = TEST_USERS.admin): Promise<void> {
  const effectiveUser = user ?? TEST_USERS.admin;
  await mockAuth(page, effectiveUser);

  // Specific first: worker status before generic pipelines wildcard
  await page.route('**/api/pipelines/worker/status', (route) =>
    route.fulfill(jsonOk({ running: false, total: 0 })),
  );

  // Generic pipelines (both **/api/pipelines** and **/api/pipelines/** variants handled by same wildcard)
  await page.route('**/api/pipelines**', (route) => route.fulfill(jsonOk([])));

  await page.route('**/api/applications**', (route) => route.fulfill(jsonOk([])));

  await page.route('**/api/deployments**', (route) => route.fulfill(jsonOk([])));

  await page.route('**/api/teams**', (route) => route.fulfill(jsonOk([])));

  await page.route('**/api/policies**', (route) => route.fulfill(jsonOk([])));

  await page.route('**/api/events**', (route) => route.fulfill(jsonOk([])));

  // Portal uses both /k8s and /kubernetes prefixes via apiClient
  await page.route('**/api/k8s/**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/kubernetes/**', (route) => route.fulfill(jsonOk([])));

  // Superset: additional endpoints observed in k8s-pages.spec.ts / settings.spec.ts
  // These ensure pages that fetch extra resources don't fall through to real network.
  await page.route('**/api/environments**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/templates**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/users**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/api-keys**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/webhooks-outbound/**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/audit-logs**', (route) => route.fulfill(jsonOk([])));
  await page.route('**/api/auth/login', (route) => route.fulfill(jsonOk(effectiveUser)));
  await page.route('**/api/users/me/notification-preferences', (route) => route.fulfill(jsonOk([])));
}

// Backward-compatible alias for specs that import mockAllApi (singular)
export const mockAllApi = mockAllApis;
