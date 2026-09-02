import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // env var injected by CI E2E (DATABASE_URL) or local .env
    url: process.env.DATABASE_URL ?? '',
  },
});
