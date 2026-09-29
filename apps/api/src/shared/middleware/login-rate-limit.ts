import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { logger } from '../logger.js';

// =============================================================================
// Authentication rate limiting (brute-force / credential-stuffing protection)
// =============================================================================
//
// Only *failed* authentication attempts consume the quota:
//   - a rejected login (HTTP 401) increments every bucket it belongs to,
//   - a successful login (HTTP 2xx) resets the account scoped buckets so a
//     legitimate user is never punished for earlier mistakes,
//   - a throttled request (HTTP 429) is rejected before the credentials are
//     evaluated and does not increment the counters, so an attacker cannot
//     extend a lockout by hammering the endpoint (nor learn anything about
//     the targeted account: the 429 body is identical for existing and
//     non-existing emails).
//
// Counters live in memory (Map + sliding window + periodic sweep): this is
// enough for a single instance / dev environment. `FailureStore` is the seam
// where a shared store (Redis, Postgres, ...) can be plugged later without
// touching the middleware itself.

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/** Maximum failed attempts per email inside the window (account targeting). */
export const LOGIN_EMAIL_LIMIT = 10;
/** Maximum failed attempts per (IP, email) pair inside the window. */
export const LOGIN_IP_EMAIL_LIMIT = 10;
/** Maximum failed attempts per IP inside the window (shared NAT / stuffing). */
export const LOGIN_IP_LIMIT = 30;

/** Result of reading one counter. */
export interface FailureSnapshot {
  /** Number of failures recorded inside the current window. */
  count: number;
  /** Seconds left before the oldest failure leaves the window (0 when clean). */
  retryAfterSeconds: number;
}

/** Storage backend for authentication failure counters. */
export interface FailureStore {
  /** Record one failed attempt and return the updated counter state. */
  recordFailure(key: string): FailureSnapshot;
  /** Read a counter without recording anything. */
  getSnapshot(key: string): FailureSnapshot;
  /** Forget every failure stored under `key` (successful authentication). */
  resetKey(key: string): void;
  /** Forget every counter (operational reset / tests). */
  resetAll(): void;
}

/** Sliding-window counter kept in memory, with periodic garbage collection. */
class InMemoryFailureStore implements FailureStore {
  private readonly hits = new Map<string, number[]>();
  private readonly sweepTimer: ReturnType<typeof setInterval>;

  constructor(private readonly windowMs: number) {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Never keep the process alive just for the cleanup tick.
    this.sweepTimer.unref();
  }

  private prune(key: string): number[] {
    const timestamps = this.hits.get(key);
    if (timestamps === undefined) {
      return [];
    }
    const cutoff = Date.now() - this.windowMs;
    const kept = timestamps.filter((timestamp) => timestamp > cutoff);
    if (kept.length === 0) {
      this.hits.delete(key);
    } else {
      this.hits.set(key, kept);
    }
    return kept;
  }

  getSnapshot(key: string): FailureSnapshot {
    const kept = this.prune(key);
    const oldest = kept[0];
    const retryAfterSeconds =
      kept.length > 0 && oldest !== undefined
        ? Math.max(1, Math.ceil((oldest + this.windowMs - Date.now()) / 1000))
        : 0;
    return { count: kept.length, retryAfterSeconds };
  }

  recordFailure(key: string): FailureSnapshot {
    const kept = this.prune(key);
    kept.push(Date.now());
    this.hits.set(key, kept);
    return this.getSnapshot(key);
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
  }

  private sweep(): void {
    for (const key of Array.from(this.hits.keys())) {
      this.prune(key);
    }
  }

  /** Stop the cleanup timer and drop every counter (used on shutdown/tests). */
  destroy(): void {
    clearInterval(this.sweepTimer);
    this.resetAll();
  }
}

let sharedStore: InMemoryFailureStore | undefined;

function resolveStore(windowMs: number, override?: FailureStore): FailureStore {
  if (override !== undefined) {
    return override;
  }
  sharedStore ??= new InMemoryFailureStore(windowMs);
  return sharedStore;
}

/** Drop every authentication failure counter held by the shared store. */
export function resetLoginRateLimit(): void {
  sharedStore?.resetAll();
}

/** Values a rate-limit bucket is built from. */
export interface AttemptContext {
  /** Client IP, from `req.ip` (spoof-resistant unless `trust proxy` is set). */
  ip: string;
  /** Normalized (trimmed, lowercased) targeted email, or `unknown`. */
  email: string;
}

/** A single counter: how many failures a given scope may accumulate. */
export interface RateLimitBucket {
  /** Bucket name, unique inside an endpoint (used for logging). */
  name: string;
  /** Maximum number of failures allowed inside the window. */
  limit: number;
  /** Whether a successful authentication clears this counter. */
  resetOnSuccess: boolean;
  /** Counter key builder. */
  buildKey: (context: AttemptContext) => string;
}

/** How a finished response is interpreted by the limiter. */
export type AttemptOutcome = 'failure' | 'success' | 'ignored';

export interface RateLimitOptions {
  /** Prefix added to every key so endpoints never share counters. */
  namespace: string;
  /** Counters checked before the request is forwarded to the route. */
  buckets: RateLimitBucket[];
  /** Decides whether a completed response consumed the quota. */
  classify: (req: Request, res: Response) => AttemptOutcome;
  /** Sliding window length (defaults to 15 minutes). */
  windowMs?: number;
  /** Alternative storage backend (defaults to the shared in-memory store). */
  store?: FailureStore;
}

function disabledRateLimit(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

function resolveContext(req: Request): AttemptContext {
  const body = req.body as { email?: unknown } | undefined;
  const rawEmail = body?.email;
  const email =
    typeof rawEmail === 'string' && rawEmail.trim().length > 0
      ? rawEmail.trim().toLowerCase()
      : 'unknown';
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return { ip: ip.length > 0 ? ip : 'unknown', email };
}

function headerValue(res: Response, name: string): string {
  const value = res.getHeader(name);
  if (Array.isArray(value)) {
    return value.join(' ');
  }
  return typeof value === 'string' ? value : '';
}

/**
 * Create a rate-limiting middleware.
 *
 * Must be mounted on the *exact* endpoint it protects, before the route
 * handler (so a throttled request never reaches the credential check).
 */
export function createRateLimit(options: RateLimitOptions): RequestHandler {
  // Tests run against a mocked database: never throttle there.
  if (process.env.NODE_ENV === 'test') {
    return disabledRateLimit;
  }

  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const store = resolveStore(windowMs, options.store);

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const context = resolveContext(req);

    const counters = options.buckets.map((bucket) => {
      const key = `${options.namespace}:${bucket.buildKey(context)}`;
      return { bucket, key, snapshot: store.getSnapshot(key) };
    });

    const blocked = counters.filter((c) => c.snapshot.count >= c.bucket.limit);
    if (blocked.length > 0) {
      const retryAfter = Math.max(...blocked.map((c) => c.snapshot.retryAfterSeconds), 1);
      logger.warn(
        {
          namespace: options.namespace,
          ip: context.ip,
          buckets: blocked.map((c) => c.bucket.name),
          retryAfterSeconds: retryAfter,
        },
        'Authentication rate limit exceeded, request rejected',
      );
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again later.',
        },
      });
      return;
    }

    res.on('finish', () => {
      const outcome = options.classify(req, res);
      if (outcome === 'failure') {
        for (const counter of counters) {
          const snapshot = store.recordFailure(counter.key);
          logger.debug(
            {
              namespace: options.namespace,
              bucket: counter.bucket.name,
              ip: context.ip,
              count: snapshot.count,
              limit: counter.bucket.limit,
            },
            'Failed authentication attempt recorded',
          );
        }
        return;
      }
      if (outcome === 'success') {
        for (const counter of counters) {
          if (counter.bucket.resetOnSuccess) {
            store.resetKey(counter.key);
          }
        }
      }
    });

    next();
  };
}

function classifyLogin(_req: Request, res: Response): AttemptOutcome {
  if (res.statusCode === 401) {
    return 'failure';
  }
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return 'success';
  }
  // 400 (validation), 5xx, ... : not an authentication outcome.
  return 'ignored';
}

/**
 * Rate limit for `POST /api/v1/auth/login`.
 *
 * Three buckets are checked for every attempt:
 *   - `email`     : 10 failures / 15 min  -> blocks targeting of one account,
 *   - `ip+email`  : 10 failures / 15 min  -> blocks one source attacking one
 *                    account (spec: "IP + email cumulés"),
 *   - `ip`        : 30 failures / 15 min  -> blocks credential stuffing across
 *                    many accounts; deliberately higher because several users
 *                    can legitimately share one NAT IP.
 *
 * Only the two account scoped buckets are reset on a successful login: the IP
 * bucket must survive a success, otherwise anyone holding one valid credential
 * could use it to renew an IP budget indefinitely.
 */
export function createLoginRateLimit(
  overrides: Partial<Pick<RateLimitOptions, 'windowMs' | 'store'>> = {},
): RequestHandler {
  return createRateLimit({
    namespace: 'login',
    classify: classifyLogin,
    buckets: [
      {
        name: 'email',
        limit: LOGIN_EMAIL_LIMIT,
        resetOnSuccess: true,
        buildKey: (context) => `email:${context.email}`,
      },
      {
        name: 'ip+email',
        limit: LOGIN_IP_EMAIL_LIMIT,
        resetOnSuccess: true,
        buildKey: (context) => `ip:${context.ip}|email:${context.email}`,
      },
      {
        name: 'ip',
        limit: LOGIN_IP_LIMIT,
        resetOnSuccess: false,
        buildKey: (context) => `ip:${context.ip}`,
      },
    ],
    ...overrides,
  });
}

function classifyOidcCallback(_req: Request, res: Response): AttemptOutcome {
  if (res.statusCode < 300 || res.statusCode >= 400) {
    return 'ignored';
  }
  const location = headerValue(res, 'location');
  // The GitHub callback redirects to `<PORTAL_URL>/login?error=...` on failure
  // and to `<PORTAL_URL>/auth/callback` on success.
  if (location.includes('/login?error=')) {
    return 'failure';
  }
  if (location.includes('/auth/callback')) {
    return 'success';
  }
  return 'ignored';
}

/**
 * Rate limit for `GET /api/v1/auth/oidc/github/callback`: stops a flood of
 * invalid/expired authorization codes. Keyed on the IP only (no email is
 * available on a redirect) with the same per-IP budget as the login endpoint.
 */
export function createOidcCallbackRateLimit(
  overrides: Partial<Pick<RateLimitOptions, 'windowMs' | 'store'>> = {},
): RequestHandler {
  return createRateLimit({
    namespace: 'oidc-callback',
    classify: classifyOidcCallback,
    buckets: [
      {
        name: 'ip',
        limit: LOGIN_IP_LIMIT,
        resetOnSuccess: false,
        buildKey: (context) => `ip:${context.ip}`,
      },
    ],
    ...overrides,
  });
}
