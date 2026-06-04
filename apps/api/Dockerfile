# ── Stage 1: Install all dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace manifest files first (for layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files preserving directory structure
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config/package.json ./packages/config/package.json

# Install all deps (needed for build)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy full source
COPY . .

# Build shared packages first, then API
RUN pnpm --filter @oias/types build
RUN pnpm --filter @oias/db build
RUN pnpm --filter @oias/api build

# ── Stage 3: Production runtime ────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace manifests for prod install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config/package.json ./packages/config/package.json

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built API output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy built shared packages (needed at runtime)
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

USER node
CMD ["node", "apps/api/dist/server.js"]
