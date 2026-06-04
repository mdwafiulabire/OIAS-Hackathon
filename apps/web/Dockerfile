# ── Stage 1: Install all dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config/package.json ./packages/config/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY . .

# Build shared packages first
RUN pnpm --filter @oias/types build

# Build Next.js app
RUN pnpm --filter @oias/web build

# ── Stage 3: Production runtime ────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config/package.json ./packages/config/package.json

RUN pnpm install --frozen-lockfile --prod

# Copy Next.js build output and public assets
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts

# Copy shared packages needed at runtime
COPY --from=builder /app/packages/types/dist ./packages/types/dist

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["pnpm", "--filter", "@oias/web", "start"]
