import 'dotenv/config';
import { env } from 'prisma/config';
import type { PrismaConfig } from 'prisma';

export default {
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL') ?? '',
  },
} satisfies PrismaConfig;
