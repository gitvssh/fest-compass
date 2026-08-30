# syntax=docker/dockerfile:1.7

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts && \
    node node_modules/prisma/build/index.js generate --schema=/app/prisma/schema.prisma

FROM deps AS builder

COPY . .
RUN npm run build

FROM base AS production-deps

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --omit=optional --ignore-scripts
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

FROM base AS runner

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP_MODE=public-readonly \
    SITE_URL=https://kto.damecasol.com \
    DATABASE_URL=file:/data/fest-compass.db

RUN mkdir -p /data /app/.next/cache && chown -R node:node /data /app

# The runtime keeps only production packages. Schema migration is performed by
# the narrow Node.js SQLite runner bundled below, not the Prisma CLI.
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/.next/seed.cjs ./prisma/seed.cjs
COPY --from=builder --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=node:node /app/prisma/migrations ./prisma/migrations
COPY --chown=node:node scripts/migrate-sqlite.mjs ./scripts/migrate-sqlite.mjs
COPY --chmod=0555 --chown=node:node docker/entrypoint.sh /usr/local/bin/fest-compass-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/fest-compass-entrypoint

USER node

EXPOSE 3000
VOLUME ["/data"]
STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/local/bin/fest-compass-entrypoint"]
CMD ["node", "server.js"]
