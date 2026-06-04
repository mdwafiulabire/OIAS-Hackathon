# OIAS Recommended Tech Stack
## Operational Intelligence and Automation System
**Version:** 1.0 | **Date:** 2026-05-22

---

## Philosophy

The stack is chosen to optimise for:
1. **Speed to Lite** — a solo dev or small team can ship the core in 6–8 weeks
2. **Plugin isolation** — plugins must not destabilise core; code boundaries match architectural boundaries
3. **Operational simplicity** — fewer moving parts to manage in production
4. **Escape velocity** — nothing here traps you; all choices are widely adopted and replaceable

---

## Recommended Stack

### Backend — Node.js + Fastify + TypeScript

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | **Node.js 22 LTS** | Single language full-stack; excellent async I/O for ticket events |
| Framework | **Fastify** | 2–3× faster than Express; built-in schema validation (JSON Schema / Zod); TypeScript-first |
| Language | **TypeScript 5.x** | Catches plugin interface contract violations at compile time |
| ORM | **Drizzle ORM** | Type-safe SQL; migrations as code; no magic; works perfectly with Postgres |
| Auth | **Better Auth** or **Auth.js** | RBAC + session management; SSO plugin (SAML/OIDC) adds without core rewrite |
| Background jobs | **BullMQ** (Redis-backed) | Handles AI calls, webhook delivery, digest emails, SLA checks — all async |
| Real-time | **Server-Sent Events (SSE)** via Fastify | Dashboard live updates without WebSocket complexity for v1 |
| File storage | **AWS S3** or **Cloudflare R2** | Attachments; R2 has no egress cost |
| Email | **Resend** or **Postmark** | Transactional email; webhooks for inbound (Email Intake plugin) |

**Why not NestJS?** Heavier scaffolding; decorator magic obscures plugin boundaries. Fastify with a manual module pattern gives the same structure with less magic.

**Why not Go/Python?** Node gives full-stack TypeScript sharing of types between front and back (Zod schemas, API contracts). Eliminates an entire category of bugs when the plugin contracts evolve.

---

### Frontend — Next.js + Tailwind + shadcn/ui

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | **Next.js 15** (App Router) | SSR for dashboards (no FOUC); React Server Components reduce client JS |
| Styling | **Tailwind CSS v4** | Utility-first; fast iteration; works well with component kits |
| Components | **shadcn/ui** | Copy-paste primitives; no version dependency; full control |
| State (server) | **TanStack Query v5** | Caching, optimistic updates, background refresh for dashboard data |
| State (client) | **Zustand** | Lightweight; replaces Redux for sidebar/modal/filter state |
| Forms | **React Hook Form + Zod** | Shared Zod schemas with backend = single source of truth for validation |
| Tables | **TanStack Table v8** | Virtual scrolling for large ticket lists; column visibility per user |
| Charts | **Recharts** | Lightweight; composable; works well with Tailwind |
| Notifications (realtime) | **SSE via EventSource** | Connects to backend SSE endpoint; no extra infra |

---

### Database

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Primary DB | **PostgreSQL 16** | The schema is relational with JSONB escape hatches for plugin configs; Postgres handles both |
| Cache / queues | **Redis (Upstash for managed)** | BullMQ job queues; session store; short-lived dashboard cache |
| Search | **Postgres full-text search** (v1) → **Typesense** (scale) | pg FTS is good enough for 100k tickets; Typesense is a drop-in upgrade when needed |
| Migrations | **Drizzle Kit** | Code-first migrations; rollback support; integrates with CI |

---

### Infrastructure

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Hosting (app) | **Railway** or **Render** (startup) → **AWS ECS** (scale) | Railway/Render: zero-infra ops for Lite launch; migrate to ECS when multi-tenant scale demands it |
| Postgres hosting | **Neon** (serverless, branching) or **Supabase** | Neon's branch-per-PR feature is excellent for testing plugin migrations safely |
| Redis | **Upstash** | Serverless Redis; no cluster to manage; BullMQ-compatible |
| File storage | **Cloudflare R2** | S3-compatible API; zero egress fees |
| CDN | **Cloudflare** | Free tier handles most traffic; DDoS protection included |
| Email infra | **Resend** | Developer-friendly; inbound email webhooks for Email Intake plugin |
| Monitoring | **Sentry** (errors) + **Axiom** (logs) | Both have generous free tiers; structured log ingestion from Fastify |
| Uptime | **Better Stack** | Cheap, reliable; integrates with Slack for on-call |
| CI/CD | **GitHub Actions** | Standard; deploy to Railway/Render or push Docker to ECR |

---

### AI Integration

| Concern | Choice | Rationale |
|---------|--------|-----------|
| AI provider | **Anthropic Claude API** (claude-sonnet-4-20250514) | Best instruction-following for structured extraction (category/priority/reply draft); JSON mode |
| AI orchestration | **Vercel AI SDK** or direct API calls | AI SDK gives streaming + tool use helpers; works with Fastify |
| AI job queue | **BullMQ** | All AI calls are async; never block ticket load |
| Prompt storage | Versioned markdown files in `/prompts/` | Prompts as code; easy to iterate; diff-tracked |

**AI call pattern:**
```
ticket.created event →
  BullMQ job: ai_suggest_triage →
    Claude API (category + priority + summary) →
      INSERT INTO ai_suggestions →
        SSE push to open ticket view
```
Agent sees the suggestion appear inline, reviews, and accepts/dismisses.

---

### Plugin Architecture Implementation

```
/src
  /core          ← stable; never edited for plugin work
    /modules
      /tickets
      /users
      /audit
  /plugins       ← each plugin is self-contained
    /due-dates
      index.ts   ← exports PluginManifest
      routes.ts  ← Fastify plugin (scoped route prefix)
      jobs.ts    ← BullMQ job definitions
      schema.ts  ← Drizzle table definitions
    /sla-policy
    /email-intake
    ...
  /plugin-loader.ts  ← reads plugin_registry, registers enabled plugins only
```

**Plugin contract (TypeScript interface):**
```typescript
interface OIASPlugin {
  key: string;                          // 'due_dates'
  name: string;                         // 'Due Dates'
  version: string;
  routes?: (app: FastifyInstance) => void;
  jobs?: BullMQJobDefinition[];
  eventHandlers?: {
    [event: string]: (payload: unknown) => Promise<void>; // ticket.created, etc.
  };
  onEnable?: (orgId: string, config: Record<string, unknown>) => Promise<void>;
  onDisable?: (orgId: string) => Promise<void>;
}
```

Plugin loader at startup:
```typescript
const enabled = await db.query.pluginRegistry.findMany({
  where: eq(pluginRegistry.isEnabled, true)
});
for (const row of enabled) {
  const plugin = await import(`./plugins/${row.pluginKey}`);
  plugin.register(app, row.config);
}
```

---

### Monorepo Structure

```
oias/
├── apps/
│   ├── api/           ← Fastify backend
│   └── web/           ← Next.js frontend
├── packages/
│   ├── db/            ← Drizzle schema + migrations (shared)
│   ├── types/         ← Shared TypeScript types + Zod schemas
│   └── config/        ← Shared ESLint, Prettier, tsconfig
├── prompts/           ← AI prompt files (versioned)
├── CLAUDE.md          ← Claude Code context (see companion file)
└── docker-compose.yml ← Local dev: Postgres + Redis
```

**Tooling:**
- Monorepo: **pnpm workspaces** + **Turborepo** (build caching)
- Linting: **ESLint + Prettier**
- Testing: **Vitest** (unit + integration) + **Playwright** (E2E for critical flows)
- Type checking: **tsc --noEmit** in CI

---

## What to Build First (Sprint 0 → Lite Launch)

### Sprint 0 — Foundation (1 week)
- [ ] Monorepo setup (pnpm + Turborepo)
- [ ] Postgres + Drizzle schema (core tables)
- [ ] Docker Compose (local Postgres + Redis)
- [ ] Fastify app skeleton with auth middleware
- [ ] Next.js app with auth pages
- [ ] CI pipeline (GitHub Actions: lint + type-check + test)

### Sprint 1 — Core Ticket Loop (2 weeks)
- [ ] User CRUD + RBAC middleware
- [ ] Ticket CRUD (create, read, update status)
- [ ] Assignment + reassignment
- [ ] Status history recording
- [ ] Internal notes
- [ ] Audit log (automatic via Fastify hook)

### Sprint 2 — Lite Signature Features (2 weeks)
- [ ] Manager dashboard (status counts, backlog by agent, overdue)
- [ ] Agent smart queue (sort by score)
- [ ] Manager daily digest (BullMQ scheduled job + email)
- [ ] AI triage suggestions (async, suggest-only)
- [ ] AI reply draft (suggest-only)

### Sprint 3 — First 3 Plugins (2 weeks)
- [ ] Due Dates plugin
- [ ] Load-balancing assignment plugin
- [ ] Performance color grading (basic)

### Sprint 4 — Polish + Launch Readiness (1 week)
- [ ] Email notifications (Resend)
- [ ] File attachments (R2)
- [ ] Export to CSV
- [ ] Responsive mobile views
- [ ] Sentry + Axiom wired up

**Total to Lite: ~8 weeks solo, ~5 weeks with 2 devs.**

---

## What to Avoid

| Temptation | Why to avoid |
|------------|-------------|
| GraphQL (v1) | Adds schema layer complexity before you know your query patterns; REST + OpenAPI is sufficient for Lite |
| Microservices | Premature split; a modular monolith with clear module boundaries is faster to ship and easier to operate |
| Kafka / event streaming | BullMQ + Postgres LISTEN/NOTIFY handles OIAS volume; Kafka is operational overhead without payoff at this scale |
| Custom auth system | Use an existing library; auth bugs are catastrophic |
| ORM with too much magic (Prisma) | Drizzle gives you SQL you can read and debug |
