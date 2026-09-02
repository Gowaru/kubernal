import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl && process.env.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = databaseUrl
  ? createPrismaClient(databaseUrl)
  : (process.env.NODE_ENV === 'test'
      ? ({} as unknown as PrismaClient)
      : createPrismaClient('postgresql://missing:missing@localhost:5432/missing'));

export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
}
