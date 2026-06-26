import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookProvider = 'github' | 'gitlab' | 'bitbucket';

export function detectProviderFromPath(provider: string): WebhookProvider | null {
  if (provider === 'github' || provider === 'gitlab' || provider === 'bitbucket') {
    return provider;
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyGitHubSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, header);
}

export function verifyGitLabSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  return safeEqual(secret, header);
}

export function verifyBitbucketSignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return safeEqual(expected, header);
}

export function verifySignature(
  provider: WebhookProvider,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  switch (provider) {
    case 'github': {
      const sig = headers['x-hub-signature-256'];
      const sigStr = Array.isArray(sig) ? sig[0] : sig;
      return verifyGitHubSignature(rawBody, sigStr, secret);
    }
    case 'gitlab': {
      const sig = headers['x-gitlab-token'];
      const sigStr = Array.isArray(sig) ? sig[0] : sig;
      return verifyGitLabSignature(rawBody, sigStr, secret);
    }
    case 'bitbucket': {
      const sig = headers['x-hub-signature'];
      const sigStr = Array.isArray(sig) ? sig[0] : sig;
      return verifyBitbucketSignature(rawBody, sigStr, secret);
    }
  }
}

export function generateSecret(): string {
  return 'whsec_' + createHmac('sha256', Date.now().toString() + Math.random().toString())
    .update('kubernal-webhook')
    .digest('hex')
    .slice(0, 48);
}

export interface ParsedPushEvent {
  ref: string;
  commitSha: string;
  repository: string;
  sender: string;
  branch: string;
}

export function parseGitHubPush(body: Record<string, unknown>): ParsedPushEvent | null {
  const ref = (body['ref'] as string | undefined) ?? '';
  const after = (body['after'] as string | undefined) ?? '';
  const repository = ((body['repository'] as Record<string, unknown> | undefined)?.['full_name'] as string | undefined) ?? '';
  const sender = ((body['sender'] as Record<string, unknown> | undefined)?.['login'] as string | undefined) ?? '';
  const branch = ref.replace('refs/heads/', '');
  if (!ref || !after) return null;
  return { ref, commitSha: after, repository, sender, branch };
}

export function parseGitLabPush(body: Record<string, unknown>): ParsedPushEvent | null {
  const ref = (body['ref'] as string | undefined) ?? '';
  const after = (body['after'] as string | undefined) ?? '';
  const repository = ((body['project'] as Record<string, unknown> | undefined)?.['path_with_namespace'] as string | undefined) ?? '';
  const userName = ((body['user_name'] as string | undefined) ?? (body['user_username'] as string | undefined)) ?? '';
  const branch = ref.replace('refs/heads/', '');
  if (!ref || !after) return null;
  return { ref, commitSha: after, repository, sender: userName, branch };
}

export function parseBitbucketPush(body: Record<string, unknown>): ParsedPushEvent | null {
  const pushData = body['push'] as { changes?: unknown } | undefined;
  const changes = (pushData?.changes ?? []) as Array<{ new?: { target?: { hash?: string }; name?: string } }>;
  const first = changes[0];
  const commitSha = first?.new?.target?.hash ?? '';
  const branch = first?.new?.name ?? '';
  const repository = ((body['repository'] as Record<string, unknown> | undefined)?.['full_name'] as string | undefined) ?? '';
  const sender = ((body['actor'] as Record<string, unknown> | undefined)?.['display_name'] as string | undefined) ?? '';
  if (!commitSha || !branch) return null;
  return { ref: `refs/heads/${branch}`, commitSha, repository, sender, branch };
}

export function parsePushEvent(
  provider: WebhookProvider,
  body: Record<string, unknown>,
): ParsedPushEvent | null {
  switch (provider) {
    case 'github':
      return parseGitHubPush(body);
    case 'gitlab':
      return parseGitLabPush(body);
    case 'bitbucket':
      return parseBitbucketPush(body);
  }
}
