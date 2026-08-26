/**
 * Vraie API helpers (when NOT mocking) — use real backend via fetch / APIRequestContext.
 *
 * These are intended for authenticated e2e against a live API (http://localhost:4000 by default).
 * They mirror the backend's /api/v1/* routes (portal proxies /api -> /api/v1).
 */

export const TEST_API_URL = process.env.API_URL ?? 'http://localhost:4000';

function normalizeBase(apiUrl: string): string {
  return apiUrl.replace(/\/$/, '');
}

function authHeaders(token: string): Record<string, string> {
  if (!token) return {};
  // Session cookie (express-session) contains '=' / ';' or connect.sid
  const isCookie = token.includes('=') || token.includes(';') || token.includes('connect.sid');
  if (isCookie) {
    return { Cookie: token };
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Authenticate against the real API and return a session cookie / token string.
 * Handles both cookie-based (express-session) and token-in-body responses.
 *
 * @param apiUrl - Base API URL, e.g. TEST_API_URL
 * @param email - User email
 * @param password - User password
 * @returns session cookie string (for use as `Cookie` header) or bearer token
 */
export async function loginAs(apiUrl: string, email: string, password: string): Promise<string> {
  const base = normalizeBase(apiUrl);
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`loginAs failed: ${res.status} ${text}`);
  }

  // Prefer Set-Cookie header (session flow)
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    // Keep only the cookie key=value pairs, strip attributes like Path/HttpOnly
    // Handles multiple cookies concatenated with ',' (fetch spec)
    return setCookie
      .split(',')
      .map((part) => part.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ');
  }

  // Fallback: token in JSON body { success:true, data: { token } } or { token }
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as Record<
    string,
    unknown
  >;
  const data = (json['data'] as Record<string, unknown> | undefined) ?? json;
  const token = (data?.['token'] as string | undefined) ?? (json['token'] as string | undefined);
  if (token) return token;

  // Some setups return user object and rely on cookie already captured above;
  // returning empty string signals cookie-based auth with no token needed (caller should have cookie).
  return '';
}

/**
 * Create a test application via the real API.
 *
 * Attempts to resolve required foreign keys (teamId, templateId, ownerId) if not provided
 * in overrides by querying the API. Caller must have appropriate role (developer+).
 *
 * @param apiUrl - Base API URL
 * @param token - Session cookie or bearer token from loginAs
 * @param overrides - Optional fields to override defaults (name, description, teamId, templateId, ownerId, repositoryUrl, config)
 */
export async function createTestApp(
  apiUrl: string,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string; [key: string]: unknown }> {
  const base = normalizeBase(apiUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(token),
  };

  const payload: Record<string, unknown> = {
    name: `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: 'E2E test application',
    repositoryUrl: 'https://github.com/octocat/Hello-World.git',
    ...overrides,
  };

  // Resolve missing required fields by querying the API (best-effort)
  if (!payload['teamId'] || !payload['templateId'] || !payload['ownerId']) {
    try {
      if (!payload['teamId']) {
        const r = await fetch(`${base}/api/v1/teams`, { headers });
        if (r.ok) {
          const j = (await r.json().catch(() => ({} as Record<string, unknown>))) as {
            data?: Array<{ id: string }>;
          };
          if (j?.data?.[0]?.id) payload['teamId'] = j.data[0].id;
        }
      }
    } catch {
      // ignore
    }
    try {
      if (!payload['templateId']) {
        const r = await fetch(`${base}/api/v1/templates`, { headers });
        if (r.ok) {
          const j = (await r.json().catch(() => ({} as Record<string, unknown>))) as {
            data?: Array<{ id: string }>;
          };
          if (j?.data?.[0]?.id) payload['templateId'] = j.data[0].id;
        }
      }
    } catch {
      // ignore
    }
    try {
      if (!payload['ownerId']) {
        const r = await fetch(`${base}/api/v1/auth/me`, { headers });
        if (r.ok) {
          const j = (await r.json().catch(() => ({} as Record<string, unknown>))) as {
            data?: { id?: string };
          };
          if (j?.data?.id) payload['ownerId'] = j.data.id;
        }
      }
    } catch {
      // ignore
    }
  }

  const res = await fetch(`${base}/api/v1/applications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createTestApp failed: ${res.status} ${text} payload=${JSON.stringify(payload)}`);
  }

  const json = (await res.json()) as { data: { id: string; name: string; [key: string]: unknown } };
  return json.data;
}

/**
 * Delete a test application via the real API.
 *
 * @param apiUrl - Base API URL
 * @param appId - Application id to delete
 * @param token - Session cookie or bearer token from loginAs
 */
export async function cleanupTestApp(apiUrl: string, appId: string, token: string): Promise<void> {
  const base = normalizeBase(apiUrl);
  const headers: Record<string, string> = {
    ...authHeaders(token),
  };

  const res = await fetch(`${base}/api/v1/applications/${encodeURIComponent(appId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const text = await res.text();
    throw new Error(`cleanupTestApp failed: ${res.status} ${text}`);
  }
}
