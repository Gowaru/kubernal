import type { IncomingMessage } from 'node:http';
import { Pool } from 'pg';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { db } from './database.js';
import { logger } from './logger.js';

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

let cachedStore: session.Store | null = null;

function getSessionStore(): session.Store {
  if (cachedStore) return cachedStore;

  const pool = (globalThis as { __sessionPgPool?: Pool }).__sessionPgPool;
  if (!pool) {
    throw new Error('Session PG pool not initialized — cannot authenticate WebSocket');
  }

  const PgSession = connectPgSimple(session);
  cachedStore = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  });
  return cachedStore;
}

const SESSION_COOKIE_NAME = 'connect.sid';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function authenticateUpgrade(
  req: IncomingMessage,
  opts: { requiredRole?: string } = {},
): Promise<AuthenticatedUser | null> {
  return new Promise((resolve) => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[SESSION_COOKIE_NAME];

    if (!sid) {
      resolve(null);
      return;
    }

    let store: session.Store;
    try {
      store = getSessionStore();
    } catch (err) {
      logger.error({ err }, 'Failed to get session store for WS auth');
      resolve(null);
      return;
    }

    store.get(sid, async (err, sessionData) => {
      if (err || !sessionData) {
        resolve(null);
        return;
      }

      const userId = (sessionData as unknown as Record<string, unknown>)['userId'] as
        | string
        | undefined;
      if (!userId) {
        resolve(null);
        return;
      }

      try {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) {
          resolve(null);
          return;
        }

        if (opts.requiredRole) {
          const roleHierarchy: Record<string, number> = {
            viewer: 0,
            developer: 1,
            platform_engineer: 2,
            admin: 3,
          };
          const userLevel = roleHierarchy[user.role] ?? -1;
          const requiredLevel = roleHierarchy[opts.requiredRole] ?? 999;
          if (userLevel < requiredLevel) {
            resolve(null);
            return;
          }
        }

        resolve({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        });
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Failed to load user during WS auth');
        resolve(null);
      }
    });
  });
}
