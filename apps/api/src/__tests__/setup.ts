import { vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'silent';

const mockDb = vi.hoisted(() => {
  const m = (): Record<string, unknown> => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findUniqueOrThrow: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  });

  return {
    user: m(),
    team: m(),
    application: m(),
    goldenPathTemplate: m(),
    environment: m(),
    deployment: m(),
    pipeline: m(),
    pipelineStep: m(),
    deploymentVulnerability: m(),
    securityPolicy: m(),
    auditLog: m(),
    webhookConfig: m(),
    webhookDelivery: m(),
    apiKey: m(),
    userNotificationPreference: m(),
    session: m(),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $connect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)({} as unknown)
        : Promise.resolve(arg),
    ),
  };
});

vi.mock('../shared/database.js', () => ({
  db: mockDb,
  createPrismaClient: vi.fn(() => mockDb),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));
