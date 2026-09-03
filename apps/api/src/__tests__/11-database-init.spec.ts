/**
 * @critical 11 - Database Init C01 — Destructive tests for DATABASE_URL guard
 *
 * What we try to break:
 * - In `test` env, missing DATABASE_URL should NOT throw: the app must work via
 *   the hoisted vi.mock in `setup.ts` (db is a mocked Prisma client). If the guard
 *   were `if (!databaseUrl) throw` without the `NODE_ENV !== 'test'` exception,
 *   all tests would fail to import `database.ts`.
 * - In `production` (or any non-test) env, missing DATABASE_URL MUST throw
 *   `DATABASE_URL environment variable is required` synchronously on module
 *   evaluation. If the throw is missing or message differs, the app would boot
 *   with an undefined connection string and crash later with an obscure error.
 *
 * How assertions fail if bug present:
 * - `expect(vi.isMockFunction(db.user.findMany)).toBe(true)` fails if the hoisted
 *   mock is not applied (e.g., wrong path `../../shared/database.js` or missing
 *   `vi.hoisted` wrapper).
 * - `expect(...).rejects.toThrow('DATABASE_URL environment variable is required')`
 *   fails if prod guard is removed, message changed, or dotenv masks the missing URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../shared/database.js';

// vi.hoisted must be defined at top-level before any mock resolution.
// Using it for expected values proves the pattern is understood and keeps
// the error message in a hoisted (mock-safe) scope.
const hoisted = vi.hoisted(() => ({
  expectedError: 'DATABASE_URL environment variable is required',
  prodUrl: 'postgresql://prod:prod@localhost:5432/prod?schema=public',
}));

describe.sequential('@critical 11 - Database Init C01', () => {
  // ---------------------------------------------------------------------------
  // Suite 1 — test env success: missing DATABASE_URL must NOT throw, mock must work
  // ---------------------------------------------------------------------------
  // We rely on setup.ts which does:
  //   process.env.DATABASE_URL ??= 'postgresql://test:...'
  //   vi.mock('../shared/database.js', () => ({ db: mockDb, ... }))
  // If database.ts incorrectly throws in test env, this suite's imports would
  // have already thrown. These tests verify the mock is actually wired.
  describe('C01 — test env via mock (should succeed without DATABASE_URL)', () => {
    it('exposes hoisted mocked db — db.user.findMany is a mock function', () => {
      // Would be false if vi.mock path is wrong or vi.hoisted not used in setup.ts
      expect(vi.isMockFunction(db.user.findMany)).toBe(true);
    });

    it('mocked db methods resolve without a real database connection', async () => {
      // Proves the hoisted mock returns resolved values; falls if mock is plain object
      const rows = await db.user.findMany();
      expect(rows).toEqual([]);
      expect(vi.isMockFunction(db.$disconnect)).toBe(true);
    });

    it('re-importing database module in test env does not throw even with empty URL', async () => {
      // Destructive: simulate what happens if DATABASE_URL is deleted in test env.
      // In test env the real module returns {} instead of throwing.
      const originalUrl = process.env.DATABASE_URL;
      const originalNodeEnv = process.env.NODE_ENV;

      // Ensure we are in test env for this check
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('DATABASE_URL', '');
      process.env.DATABASE_URL = '';

      vi.resetModules();

      // Use importActual to bypass the global vi.mock and hit real database.ts logic
      // In test env with empty URL it should NOT reject
      await expect(vi.importActual('../shared/database.js')).resolves.toBeDefined();

      // Restore
      vi.unstubAllEnvs();
      if (originalUrl !== undefined) process.env.DATABASE_URL = originalUrl;
      else delete process.env.DATABASE_URL;
      if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
      vi.resetModules();
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 2 — prod env failure: missing DATABASE_URL MUST throw
  // ---------------------------------------------------------------------------
  describe('C01 — production env without DATABASE_URL must throw', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      // Restore original env to avoid leaking prod state into other suites
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete process.env[key];
      }
      for (const [k, v] of Object.entries(originalEnv)) {
        process.env[k] = v as string;
      }
      vi.resetModules();
    });

    it('throws DATABASE_URL required when NODE_ENV=production and URL is empty', async () => {
      // What we break: if guard `if (!databaseUrl && NODE_ENV !== 'test') throw` is removed,
      // the import would succeed and this rejection would not happen.
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', '');
      process.env.DATABASE_URL = '';
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      await expect(vi.importActual('../shared/database.js')).rejects.toThrow(hoisted.expectedError);
    });

    it('throws with exact error message DATABASE_URL environment variable is required', async () => {
      // Message must be exact; a generic "missing env" would fail this
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', '');
      process.env.DATABASE_URL = '';
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      await expect(vi.importActual('../shared/database.js')).rejects.toThrow(
        'DATABASE_URL environment variable is required',
      );
    });

    it('throws synchronously on module evaluation (import rejects, not later call)', async () => {
      // Ensures throw is at top-level, not deferred to createPrismaClient()
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', '');
      process.env.DATABASE_URL = '';
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      let didThrow = false;
      try {
        await vi.importActual('../shared/database.js');
      } catch (e) {
        didThrow = true;
        expect((e as Error).message).toBe(hoisted.expectedError);
      }
      expect(didThrow).toBe(true);
    });

    it('does NOT throw when DATABASE_URL is provided in production', async () => {
      // Control: with a URL, prod import should succeed (creates PrismaClient)
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', hoisted.prodUrl);
      process.env.DATABASE_URL = hoisted.prodUrl;
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      // Should resolve to a module with createPrismaClient/db; if it rejects, guard is too aggressive
      await expect(vi.importActual('../shared/database.js')).resolves.toBeDefined();
    });
  });
});
