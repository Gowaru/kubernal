FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json ./packages/shared-types/
RUN npm ci --workspaces --ignore-scripts

COPY . .
RUN npm run build -w packages/shared-types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w apps/api
RUN npm prune --omit=dev --workspaces

FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/package.json ./apps/api/

EXPOSE 4000

CMD ["sh", "-c", "npx prisma@^7.0.0 migrate deploy --config apps/api/prisma.config.ts && node apps/api/dist/main.js"]
