import type { Request } from 'express';
import { randomBytes } from 'node:crypto';

export interface GitHubProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export function getGitHubAuthUrl(req: Request): string {
  const clientId = process.env['GITHUB_CLIENT_ID'];
  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID environment variable is required');
  }

  const baseUrl = process.env['API_BASE_URL'] || `http://${req.headers.host ?? 'localhost:4000'}`;
  const redirectUri = `${baseUrl}/api/v1/auth/oidc/github/callback`;

  const state = randomBytes(32).toString('hex');
  (req.session as unknown as Record<string, unknown>).oidcState = state;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function handleGitHubCallback(code: string): Promise<GitHubProfile> {
  const clientId = process.env['GITHUB_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? 'Failed to obtain GitHub access token');
  }

  const accessToken = tokenData.access_token;

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    }),
  ]);

  if (!userRes.ok) {
    throw new Error(`GitHub user fetch failed: ${userRes.status}`);
  }

  const ghUser = await userRes.json() as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  const ghEmails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;

  const primaryEmail = ghEmails.find((e) => e.primary && e.verified)?.email
    ?? ghEmails.find((e) => e.verified)?.email
    ?? ghEmails[0]?.email;

  if (!primaryEmail) {
    throw new Error('No verified email found on GitHub account');
  }

  return {
    id: String(ghUser.id),
    email: primaryEmail,
    name: ghUser.name ?? ghUser.login,
    avatarUrl: ghUser.avatar_url,
  };
}
