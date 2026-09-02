/* eslint-disable no-console */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { createRouter } from './modules/infrastructure/http/router.js';
import { mountSwaggerUi } from './shared/swagger-ui.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { notFoundHandler } from './shared/middleware/not-found.js';
import { auditContext } from './shared/middleware/audit-context.js';
import { trackRequest, getMetrics } from './shared/metrics.js';
import { startPipelineWorker } from './modules/pipeline/worker.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { deserializeUser } from './shared/middleware/deserialize-user.js';
import { sessionRefresh } from './shared/middleware/session-refresh.js';
import type { User } from '@kubernal/shared-types';

const PgSession = connectPgSimple(session);

export function setTestUser(user: User | undefined): void {
  (globalThis as { __testUser?: User }).__testUser = user;
}

export function createApp(): express.Application {
  const app = express();
  const testUser = (globalThis as { __testUser?: User }).__testUser;

  app.use(helmet());
  const corsOrigins = (
    process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:7007'
  ).split(',');
  app.use(cors({ origin: corsOrigins }));

  if (testUser) {
    app.use((req, _res, next) => {
      (req as typeof req & { user?: User }).user = testUser;
      next();
    });
  }

  const sessionSecret = process.env['SESSION_SECRET'];
  const maxAge = parseInt(process.env['SESSION_MAX_AGE_SECONDS'] ?? '86400', 10) * 1000;
  const rememberMaxAge =
    parseInt(process.env['SESSION_REMEMBER_MAX_AGE_SECONDS'] ?? '604800', 10) * 1000;

  if (sessionSecret && sessionSecret.length >= 32) {
    const pgPool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    (globalThis as { __sessionPgPool?: Pool }).__sessionPgPool = pgPool;
    app.use(
      session({
        store: new PgSession({
          pool: pgPool,
          tableName: 'session',
          createTableIfMissing: true,
          pruneSessionInterval: parseInt(
            process.env['SESSION_PRUNE_INTERVAL_SECONDS'] ?? '900',
            10,
          ),
        }),
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'lax',
          maxAge,
        },
      }),
    );

    app.use((req, _res, next) => {
      const currentMax = req.session.cookie.maxAge;
      if (currentMax === undefined) {
        req.session.cookie.maxAge = maxAge;
      }
      next();
    });

    app.use(deserializeUser);
    app.use(sessionRefresh);
  }

  app.locals.sessionDefaults = { maxAge, rememberMaxAge };

  app.use('/api/v1/webhooks/:appId/:provider', (req, _res, next) => {
    express.raw({ type: '*/*', limit: '5mb' })(req, _res, (err) => {
      if (err) return next(err);
      const raw = (req as unknown as { body?: Buffer | string }).body;
      (req as unknown as { rawBody?: string }).rawBody =
        typeof raw === 'string' ? raw : (raw?.toString('utf8') ?? '');
      next();
    });
  });

  app.use(express.json({ limit: '1mb' }));

  app.use(auditContext);

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      trackRequest(req.method, req.route?.path ?? req.path, res.statusCode, Date.now() - start);
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'kubernal-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(await getMetrics());
  });

  app.use('/api/v1/auth', createAuthRouter());

  const apiRouter = createRouter();
  mountSwaggerUi(apiRouter);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (process.env.PIPELINE_WORKER_ENABLED !== 'false') {
    const worker = startPipelineWorker({ intervalMs: 5000 });
    console.log('[bootstrap] pipeline worker started (5s interval)');
    (globalThis as { __pipelineWorker?: { stop: () => void } }).__pipelineWorker = worker;
  }

  return app;
}
