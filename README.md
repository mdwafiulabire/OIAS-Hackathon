# OIAS — Operational Intelligence and Automation System

Modular operations control platform for SMEs: tracked, auditable, AI-assisted ticket and case management.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 |
| pnpm | 9.15.4 |
| Docker + Docker Compose | v2 |
| PostgreSQL (via Docker) | 16 |

---

## Quickstart

### Option A — one command (recommended)

```bash
git clone <repo-url> oias && cd oias
cp .env.example .env       # fill AZURE_AI_FOUNDRY_* values
docker compose up --build
```

Brings up Postgres, Redis, runs migrations + seed, then starts the API (`:3001`) and web (`:3000`). Open [http://localhost:3000](http://localhost:3000) once `api` reports healthy.

### Option B — local dev with hot reload

```bash
git clone <repo-url> oias && cd oias
cp .env.example .env
docker compose up postgres redis -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js 22 + Fastify + TypeScript |
| ORM | Drizzle ORM + Drizzle Kit |
| Frontend | Next.js 15 App Router + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7 + BullMQ |
| Auth | Better Auth |
| AI | Anthropic Claude API |
| File storage | Cloudflare R2 |
| Email | Resend |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest + Playwright |

---

## Project Structure

```
oias/
├── apps/
│   ├── api/                  Fastify + TypeScript backend (port 3001)
│   │   └── src/
│   │       ├── core/         Stable core modules (tickets, users, notes, audit…)
│   │       ├── plugins/      One folder per optional plugin
│   │       ├── plugin-loader.ts
│   │       ├── event-bus.ts
│   │       └── app.ts
│   └── web/                  Next.js 15 App Router frontend (port 3000)
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   ├── db/                   Drizzle schema + migrations + seed
│   ├── types/                Shared Zod schemas + TypeScript types
│   └── config/               ESLint, tsconfig, Prettier
├── prompts/                  AI prompt files (versioned markdown)
├── docs/                     PRD, schema SQL, tech-stack rationale
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                 Contributor guidelines (AI + human)
```

---

## Seed Credentials (DEV ONLY)

All seed users have password `password123`. Never use these in production.

| Email | Role |
|-------|------|
| admin@acme.test | admin |
| manager@acme.test | manager |
| agent@acme.test | agent |
| viewer@acme.test | viewer |

Demo org: **Acme Operations** (`slug: acme`)

---

## Useful Scripts

```bash
# Development
pnpm dev                  # Start all apps in watch mode
pnpm build                # Production build (all packages)
pnpm typecheck            # Type-check all packages

# Database
pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:push              # Push schema directly (dev shortcut — no migration file)
pnpm db:seed              # Insert demo data (idempotent)
pnpm db:studio            # Open Drizzle Studio GUI

# Testing
pnpm test                 # Run all Vitest unit + integration tests

# Docker (full stack)
docker compose up -d              # Build and start all services
docker compose up postgres redis -d   # Infrastructure only
docker compose logs api -f        # Stream API logs
```

---

## Health Check

```
GET /api/v1/health
```

Returns `{ "status": "ok", "uptime": <seconds>, "timestamp": "...", "db": "ok" }`. No auth required.

---

## Contributor Docs

- See [CLAUDE.md](./CLAUDE.md) for architecture rules, plugin contracts, RBAC reference, and code style.
- See [docs/OIAS_PRD.md](./docs/OIAS_PRD.md) for full product requirements.
