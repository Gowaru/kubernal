/**
 * Public API serialization – single source of truth.
 *
 * Sensitive columns must never reach an HTTP response:
 *   - User.passwordHash (bcrypt), User.oidcId (external IdP subject)
 *   - Application.webhookSecret (inbound HMAC secret)
 *   - WebhookConfig.secret (outbound HMAC secret)
 *   - ApiKey.keyHash (SHA-256 of the API key)
 *
 * Two complementary mechanisms are used, both defined here:
 *
 *  1. `publicUserSelect` / `publicApplicationSelect` / ... Prisma `select` objects.
 *     Repositories must use them so sensitive columns are never even fetched from
 *     the database. Because the resulting Prisma payload type simply does not
 *     contain the sensitive keys, TypeScript rejects any leak at compile time.
 *
 *  2. `toPublicUser()` / `toPublicWebhookConfig()` mappers, for the code paths that
 *     legitimately need the full row internally (login, session deserialization,
 *     webhook dispatch) and must strip it before returning.
 *
 * Anything exposed instead of a secret must be a derived boolean (see
 * `hasSecret`), never the secret itself.
 */
import type { Prisma } from '@prisma/client';

// ─── User ─────────────────────────────────────────────────────────────────────

/** Public `User` projection: no `passwordHash`, no `oidcId`. */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  teamId: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/** Same projection, with the (non-sensitive) `team` relation. */
export const publicUserWithTeamSelect = {
  ...publicUserSelect,
  team: true,
} as const satisfies Prisma.UserSelect;

export type PublicUserWithTeam = Prisma.UserGetPayload<{
  select: typeof publicUserWithTeamSelect;
}>;

/** Any row that may carry a password hash (full `db.user.*` result). */
type UserWithSecrets = {
  passwordHash?: string | null;
  oidcId?: string | null;
};

/**
 * Strip sensitive fields from a full `User` row.
 * Used when the row had to be fetched complete (authentication, session lookup).
 */
export function toPublicUser<T extends UserWithSecrets>(
  user: T,
): Omit<T, 'passwordHash' | 'oidcId'> {
  const { passwordHash, oidcId, ...safeUser } = user;
  void passwordHash;
  void oidcId;
  return safeUser;
}

// ─── Application ──────────────────────────────────────────────────────────────

/** Public `Application` scalar fields: `webhookSecret` is deliberately absent. */
export const publicApplicationSelect = {
  id: true,
  name: true,
  description: true,
  templateId: true,
  teamId: true,
  ownerId: true,
  repositoryUrl: true,
  status: true,
  config: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ApplicationSelect;

export type PublicApplication = Prisma.ApplicationGetPayload<{
  select: typeof publicApplicationSelect;
}>;

/** Full public `Application` (scalars + team + template + sanitized owner). */
export const publicApplicationWithRelationsSelect = {
  ...publicApplicationSelect,
  team: true,
  template: true,
  owner: { select: publicUserSelect },
} as const satisfies Prisma.ApplicationSelect;

export type PublicApplicationWithRelations = Prisma.ApplicationGetPayload<{
  select: typeof publicApplicationWithRelationsSelect;
}>;

// ─── WebhookConfig ────────────────────────────────────────────────────────────

/** WebhookConfig as exposed to clients: the HMAC secret is replaced by a boolean. */
export interface PublicWebhookConfig {
  id: string;
  applicationId: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasSecret: boolean;
}

type WebhookConfigRow = {
  id: string;
  applicationId: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Never returns `secret`; exposes `hasSecret` instead. */
export function toPublicWebhookConfig(config: WebhookConfigRow): PublicWebhookConfig {
  const { secret, ...safeConfig } = config;
  return { ...safeConfig, hasSecret: !!secret };
}

// ─── Redaction (audit logs, log payloads) ─────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'plainkey',
  'authorization',
  'cookie',
  'credential',
  'credentials',
  'privatekey',
]);

const SENSITIVE_KEY_SUFFIXES = ['hash', 'secret', 'token', 'password'];

/** True when a property name looks like it carries a credential. */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return SENSITIVE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Recursively replace credential-looking values with `***`.
 * Used before writing a payload to the audit log.
 */
export function redactSensitiveKeys(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);
  if (value instanceof Date) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      redacted[key] = '***';
    } else {
      redacted[key] = redactSensitiveKeys(entry);
    }
  }
  return redacted;
}
