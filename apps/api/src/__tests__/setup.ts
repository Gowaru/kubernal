import { vi } from 'vitest';

vi.mock('../../shared/database.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  createPrismaClient: vi.fn(),
  disconnectDatabase: vi.fn(),
}));