/* eslint-disable no-console */
import 'dotenv/config';
import { Pool } from 'pg';

const TABLE_NAME = 'session';

async function cleanupSessions(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('[cleanup-sessions] DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(
      `DELETE FROM "${TABLE_NAME}" WHERE "expire" < NOW()`,
    );
    const count = result.rowCount ?? 0;
    console.log(`[cleanup-sessions] ${count} expired session(s) deleted`);
  } catch (err) {
    console.error('[cleanup-sessions] failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanupSessions();
