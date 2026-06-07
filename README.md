# OIAS — Operational Intelligence and Automation System

Modular ops platform for SMEs: tracked, auditable, AI-assisted ticket and case management.

**🏆 Microsoft Agents League submission** — Reasoning Agents track
**🧠 IQ layer:** Foundry IQ (Agent Service + File Search grounding)
**🤖 AI:** Azure AI Foundry Agent Service

→ Architecture, reasoning chain, judging-criteria mapping: [docs/architecture.md](./docs/architecture.md)
→ Demo video script: [docs/demo-script.md](./docs/demo-script.md)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 |
| pnpm | 9.15.4 |
| Docker + Docker Compose | v2 |
| PostgreSQL (via Docker) | 16 |
| Azure subscription | $200 free credit is enough |

---

## Quickstart

### Option A — one command (recommended)

```bash
git clone https://github.com/mdwafiulabire/OIAS-Hackathon.git oias && cd oias
cp .env.example .env       # fill the AZURE_AI_FOUNDRY_* values (see below)
docker compose up --build
```

Brings up Postgres, Redis, runs migrations, bootstraps the demo login + data, then starts API (`:3001`) and web (`:3000`). Open [http://localhost:3000](http://localhost:3000) once `api` reports healthy.

### Option B — local dev with hot reload

```bash
git clone https://github.com/mdwafiulabire/OIAS-Hackathon.git oias && cd oias
cp .env.example .env
docker compose up postgres redis -d
pnpm install
pnpm db:migrate
pnpm --filter @oias/api bootstrap   # creates the working demo login + data
pnpm dev
```

---

## Required environment variables

The four `AZURE_AI_FOUNDRY_*` vars are the only ones you must set yourself. Everything else has working defaults.

```env
AZURE_AI_FOUNDRY_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project-name>
AZURE_AI_FOUNDRY_API_KEY=<key from ai.azure.com → Settings → Keys and Endpoint>
AZURE_AI_FOUNDRY_AGENT=<agent ID asst_… OR display name; resolver handles both>
AZURE_AI_FOUNDRY_API_VERSION=2025-05-01
```

### Getting these from Azure

1. Sign in to https://ai.azure.com
2. **+ New project** → pick a region with `gpt-4o-mini` availability (Sweden Central, East US 2)
3. **Models + endpoints** → Deploy `gpt-4o-mini`
4. **Agents** → **+ New agent** → paste [prompts/triage.md](./prompts/triage.md) as Instructions → toggle **File search** ON → Save → copy the agent's name or `asst_…` ID
5. Project home → **Overview** → copy the **Project endpoint** URL
6. **Settings → Keys and Endpoint** → copy Key 1
7. Paste all four values into `.env`

---

## Demo login

After `docker compose up --build` (or `pnpm bootstrap`) finishes:

| Email | Password | Role |
|-------|----------|------|
| `admin@acme.test` | `password123` | admin |

Org: **Acme Operations** — pre-seeded with 3 categories, 5 demo tickets, and `ai_triage` + `due_dates` enabled in `plugin_registry`.

> Dev only — never use in production.

To create your own login instead: visit http://localhost:3000/register and sign up. Better Auth's `user.create` after-hook ([apps/api/src/core/modules/auth/auth.ts](./apps/api/src/core/modules/auth/auth.ts)) provisions an org + admin role for you automatically.

---

## Verify the AI pipeline

After login, prove Azure AI Foundry is reachable from the API:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/plugins/ai_triage/health
# → { ok: true, agentId: "asst_..." }
```

Then create a ticket via the web UI. The API logs show:

```
ai_triage suggestion created { ticketId: '...', durationMs: ~3500 }
```

A row appears in `ai_suggestions` with `status='pending'`, the agent's structured JSON in `payload`, and full traceability (Foundry `threadId` + `runId`) in `audit_logs`. The UI surfaces the suggestion on the ticket detail page with Accept / Dismiss controls.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js 22 + Fastify + TypeScript |
| ORM | Drizzle ORM + Drizzle Kit |
| Frontend | Next.js 15 App Router + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ (event bus today is in-process) |
| Auth | Better Auth (email + password, scrypt) |
| AI | **Azure AI Foundry Agent Service** (REST via fetch, no SDK churn) |
| File storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest + Playwright |

---

## Project structure

```
oias/
├── apps/
│   ├── api/                         Fastify + TypeScript backend (:3001)
│   │   └── src/
│   │       ├── core/                Stable core modules (tickets, users, notes, audit…)
│   │       │   └── ai/
│   │       │       └── foundry-client.ts   ← REST wrapper for Foundry Agent Service
│   │       ├── plugins/             One folder per optional plugin
│   │       │   ├── ai-triage/       ← Reasoning Agents track — Foundry integration
│   │       │   └── due-dates/
│   │       ├── scripts/
│   │       │   └── bootstrap.ts     ← Better Auth signup + demo data
│   │       ├── plugin-loader.ts
│   │       ├── event-bus.ts
│   │       └── app.ts
│   └── web/                         Next.js 15 App Router frontend (:3000)
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   ├── db/                          Drizzle schema + migrations
│   ├── types/                       Shared Zod schemas + TypeScript types
│   └── config/                      ESLint, tsconfig, Prettier
├── prompts/                         AI prompt files (versioned markdown)
│   ├── triage.md                    ← System prompt for the Foundry agent
│   ├── reply-draft.md
│   ├── summary.md
│   └── manager-brief.md
├── docs/
│   ├── architecture.md              ← Mermaid diagram + judging-criteria mapping
│   ├── demo-script.md               ← 4:30 video script with checklist
│   ├── OIAS_PRD.md
│   ├── OIAS_TechStack.md
│   └── OIAS_schema.sql
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                        Contributor + AI guidelines
```

---

## Useful scripts

```bash
# Development
pnpm dev                                # Start all apps in watch mode
pnpm build                              # Production build (all packages)
pnpm typecheck                          # Type-check the entire workspace

# Database
pnpm db:generate                        # Generate Drizzle migration from schema changes
pnpm db:migrate                         # Apply pending migrations
pnpm db:push                            # Push schema directly (dev shortcut)
pnpm db:studio                          # Open Drizzle Studio GUI

# Demo data + login
pnpm --filter @oias/api bootstrap       # Create admin@acme.test + seed categories/tickets/plugins
# pnpm db:seed                          # DEPRECATED — see deprecation notice in packages/db/src/seed.ts

# Testing
pnpm test                               # Run all Vitest unit + integration tests

# Docker (full stack)
docker compose up --build               # First boot or after dependency change
docker compose up -d                    # Detached
docker compose up postgres redis -d     # Infrastructure only (for hot-reload dev)
docker compose logs -f api              # Stream API logs
docker compose logs -f web              # Stream web logs
docker compose down                     # Stop everything
docker compose down -v                  # Stop + wipe DB volume (fresh bootstrap on next up)
```

---

## Health checks

| Endpoint | Auth | Returns |
|----------|------|---------|
| `GET /api/v1/health` | none | `{ status: "ok", uptime, timestamp, db: "ok" }` |
| `GET /api/v1/plugins/ai_triage/health` | none | `{ ok: true, agentId: "asst_..." }` if Foundry is reachable |

---

## AI Triage plugin — what it does

Listens to `ticket.created` on the in-process event bus. For each new ticket:

1. Verifies `ai_triage` is enabled for the org in `plugin_registry`.
2. Loads the ticket + the org's active category names.
3. Calls the Foundry agent via REST (`thread → message → run → poll`).
4. Foundry runs its 7-step reasoning chain (retrieve → classify → score → summarise → justify → confidence → emit) with **File Search** grounding (Foundry IQ).
5. Parses the agent's structured JSON.
6. Inserts an `ai_suggestions` row with `status='pending'` — **nothing is auto-applied; a human accepts or dismisses**.
7. Mirrors the action in `audit_logs` with the Foundry `threadId` + `runId` for full traceability.

Endpoints exposed by the plugin (all under `/api/v1/plugins/ai_triage/`):

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | none | Foundry reachability probe |
| `GET /ticket/:ticketId` | session | List suggestions for a ticket |
| `POST /:id/accept` | session + role | Mark suggestion accepted |
| `POST /:id/dismiss` | session + role | Mark suggestion dismissed |

Source: [apps/api/src/plugins/ai-triage/index.ts](./apps/api/src/plugins/ai-triage/index.ts).

---

## Contributor docs

- [CLAUDE.md](./CLAUDE.md) — architecture rules, plugin contracts, RBAC reference, code style
- [docs/architecture.md](./docs/architecture.md) — Foundry integration diagram + reasoning chain + judging map
- [docs/demo-script.md](./docs/demo-script.md) — 4:30 demo video script
- [docs/OIAS_PRD.md](./docs/OIAS_PRD.md) — full product requirements
- [prompts/triage.md](./prompts/triage.md) — the system prompt baked into the Foundry agent
