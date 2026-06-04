# OIAS — Claude Code Context
## Operational Intelligence and Automation System
**Last updated:** 2026-05-22

This file is the source of truth for every Claude Code session on this project.
Read it fully before writing any code, proposing any schema change, or creating any file.

---

## What This Product Is

OIAS is a **modular operations control platform** for SMEs. It gives operations teams a tracked, auditable, AI-assisted way to manage requests, tickets, and cases.

**Three tiers:**
- **Lite** — fixed core, fast to deploy. Makes ops teams feel "fixed", not "tooled".
- **Lite + Plugins** — client selects 2–6 plugins from a menu.
- **Advanced** — Lite + most plugins + enterprise controls (SLA, approvals, multi-team, compliance).

**Non-negotiable product principle:** Core stays stable. Plugins extend it. A plugin failure must never crash or corrupt the core.

---

## Monorepo Structure

```
oias/
├── apps/
│   ├── api/              ← Fastify + TypeScript backend
│   │   ├── src/
│   │   │   ├── core/     ← stable; never touch for plugin work
│   │   │   │   ├── modules/tickets/
│   │   │   │   ├── modules/users/
│   │   │   │   ├── modules/notes/
│   │   │   │   ├── modules/audit/
│   │   │   │   └── modules/notifications/
│   │   │   ├── plugins/  ← one folder per plugin
│   │   │   │   ├── due-dates/
│   │   │   │   ├── sla-policy/
│   │   │   │   ├── email-intake/
│   │   │   │   └── ... (one folder per plugin key)
│   │   │   ├── plugin-loader.ts
│   │   │   ├── event-bus.ts
│   │   │   └── app.ts
│   └── web/              ← Next.js 15 App Router frontend
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   ├── db/               ← Drizzle schema + migrations
│   ├── types/            ← Shared Zod schemas + TypeScript types
│   └── config/           ← ESLint, tsconfig, Prettier
├── prompts/              ← AI prompt files (markdown, versioned)
├── CLAUDE.md             ← THIS FILE
└── docker-compose.yml
```

---

## Tech Stack (do not deviate without discussing first)

| Layer | Choice |
|-------|--------|
| Backend | **Node.js 22** + **Fastify** + **TypeScript** |
| ORM | **Drizzle ORM** (Drizzle Kit for migrations) |
| Frontend | **Next.js 15** App Router + **TypeScript** |
| Styling | **Tailwind CSS v4** + **shadcn/ui** |
| Database | **PostgreSQL 16** |
| Cache / Queues | **Redis** via **BullMQ** |
| Auth | **Better Auth** |
| AI | **Anthropic Claude API** (`claude-sonnet-4-20250514`) |
| File storage | **Cloudflare R2** (S3-compatible) |
| Email | **Resend** |
| Monorepo | **pnpm workspaces** + **Turborepo** |
| Testing | **Vitest** + **Playwright** (E2E) |

---

## Database Rules

1. **Every tenant-scoped table has `org_id UUID NOT NULL`** — no exceptions.
2. **PKs are UUIDs** (`uuid_generate_v4()`), never serial integers.
3. **Soft deletes** where history matters: `deleted_at TIMESTAMPTZ` (nullable).
4. **Audit log is append-only** — never write an `UPDATE` or `DELETE` against `audit_logs` or `ticket_status_history`.
5. **Plugin tables** are named `plugin_<key>_<entity>` (e.g. `plugin_due_dates_entries`).
6. **Plugin tables FK to core tables. Core tables NEVER reference plugin tables.**
7. Migrations live in `packages/db/migrations/`. Always use `drizzle-kit generate` — never hand-edit migration files.
8. When adding a column to an existing table, make it nullable or provide a default — never a bare `NOT NULL` on a populated table.

### Core Tables (memorise these)
```
organisations       → root tenant record
users               → org members + roles (admin/manager/agent/viewer)
teams               → optional grouping (Advanced)
team_members        → users ↔ teams join
categories          → configurable ticket categories per org
tickets             → central entity (ref_number, status, priority, assignee)
ticket_status_history → immutable status transition log
ticket_assignments  → immutable assignment change log
notes               → internal + external messages on tickets
attachments         → files on tickets or notes
notifications       → async delivery log
audit_logs          → append-only action log
ai_suggestions      → AI outputs + human review outcomes
plugin_registry     → enabled plugins per org + config
```

---

## Plugin Architecture Rules

Every plugin **must** implement the `OIASPlugin` interface from `packages/types/src/plugin.ts`:

```typescript
interface OIASPlugin {
  key: string;           // snake_case, matches plugin_registry.plugin_key
  name: string;
  version: string;
  routes?: (app: FastifyInstance) => void;
  jobs?: BullMQJobDefinition[];
  eventHandlers?: {
    [event: EventBusEvent]: (payload: EventPayload) => Promise<void>;
  };
  onEnable?: (orgId: string, config: PluginConfig) => Promise<void>;
  onDisable?: (orgId: string) => Promise<void>;
}
```

**Plugin event hooks** (defined in `src/event-bus.ts`):
```
ticket.created          ticket.updated          ticket.status_changed
ticket.assigned         ticket.reassigned       ticket.overdue
ticket.resolved         ticket.closed           ticket.reopened
note.created            attachment.added
ai.suggestion_created   ai.suggestion_accepted  ai.suggestion_dismissed
user.created            user.deactivated
```

**Plugins must:**
- Check `plugin_registry` to confirm they're enabled for the requesting `org_id` before executing any logic.
- Handle their own errors and never throw unhandled rejections that reach core.
- Add their own Drizzle table definitions in `plugins/<key>/schema.ts`.

**Plugins must not:**
- Import from `core/` except types and utility functions.
- Modify core table schemas.
- Directly query core tables without going through the core service layer.

---

## API Conventions

- **REST** with **OpenAPI 3.1** spec (auto-generated via Fastify's schema validation).
- All routes are prefixed `/api/v1/`.
- Auth: **Bearer token** (JWT) from Better Auth. The middleware attaches `req.user` and `req.orgId`.
- Every route handler receives `orgId` from `req.orgId` — never trust `org_id` from the request body.
- Standard response envelope:
  ```json
  { "data": { ... }, "meta": { "requestId": "...", "timestamp": "..." } }
  ```
- Error envelope:
  ```json
  { "error": { "code": "TICKET_NOT_FOUND", "message": "...", "status": 404 } }
  ```
- Pagination: cursor-based (`?cursor=<uuid>&limit=50`). Never offset pagination.
- Sorting and filtering params are camelCase query strings: `?assigneeId=&status=in_progress`.

---

## AI Integration Rules

1. All AI calls are **async via BullMQ** — ticket loading must never block on AI.
2. AI outputs are stored in `ai_suggestions` with `status = 'pending'` until a human acts.
3. No AI action is applied to a ticket without explicit human approval (`accepted` status).
4. Prompt files live in `/prompts/<feature>.md`. Reference them by file path in code — do not inline prompts in source files.
5. Always use model `claude-sonnet-4-20250514` unless a specific task requires different capabilities.
6. Request structured output via JSON mode. Parse and validate with Zod before persisting.
7. AI errors are logged but must not surface as user-visible errors (graceful degradation — the ticket works, the suggestion just doesn't appear).

---

## Audit Logging

Every write operation that changes business state **must** emit an audit log entry.
Use the `auditLog()` helper from `core/modules/audit/audit.service.ts`:

```typescript
await auditLog(db, {
  orgId: req.orgId,
  actorId: req.user.id,
  action: 'ticket.status_changed',
  entityType: 'ticket',
  entityId: ticket.id,
  payload: { before: { status: oldStatus }, after: { status: newStatus } },
  ipAddress: req.ip,
});
```

This must be called **within the same database transaction** as the change it records.

---

## RBAC Reference

| Action | admin | manager | agent | viewer |
|--------|-------|---------|-------|--------|
| Create ticket | ✓ | ✓ | ✓ | ✗ |
| Assign ticket | ✓ | ✓ | ✗ | ✗ |
| Change status | ✓ | ✓ | ✓ (own) | ✗ |
| Add internal note | ✓ | ✓ | ✓ | ✗ |
| View all tickets | ✓ | ✓ | own queue | ✓ |
| View audit log | ✓ | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ |
| Enable plugins | ✓ | ✗ | ✗ | ✗ |
| View dashboard | ✓ | ✓ | own stats | ✓ |

Use the `requireRole()` middleware helper from `core/modules/auth/rbac.ts`.

---

## Code Style

- **TypeScript strict mode** — `"strict": true` in tsconfig. No `any` without a comment explaining why.
- **Zod** for all runtime validation (API input, AI output, plugin config).
- **Drizzle** for all DB queries — no raw SQL except in migration files.
- **No `console.log`** in production code — use the `logger` from `app.ts` (Fastify's built-in pino logger).
- **Error handling**: use custom error classes from `packages/types/src/errors.ts`. Never throw plain `Error` objects from service functions.
- **No magic numbers** — extract to named constants.
- File naming: `kebab-case` for files, `PascalCase` for React components, `camelCase` for functions and variables.

---

## Testing Requirements

- **Unit tests** for all service functions (pure logic, no DB).
- **Integration tests** for all API routes — use a real test Postgres DB (Docker).
- **Plugin tests** must include: plugin disabled → feature not available; plugin enabled → feature works.
- Coverage target: 80% on `core/` modules.
- Test files co-located: `tickets.service.test.ts` next to `tickets.service.ts`.

---

## Common Tasks & Where to Start

| Task | Start here |
|------|------------|
| Add a new ticket field | `packages/db/` → schema → migration → `packages/types/` → API route |
| Add a new plugin | Copy `plugins/due-dates/` as template; implement `OIASPlugin`; add to plugin loader |
| Add a new event | `src/event-bus.ts` → add to `EventBusEvent` union type → update `packages/types/` |
| Add a new AI feature | `/prompts/<feature>.md` → BullMQ job in `plugins/<key>/jobs.ts` → `ai_suggestions` insert |
| Add a new dashboard widget | `apps/web/components/dashboard/` → TanStack Query hook → SSE connection if real-time |
| Debug a plugin not running | Check `plugin_registry` row for `org_id`; check BullMQ dashboard (Bull Board) |

---

## Things Claude Should Never Do In This Codebase

- **Never** add a direct FK from a core table to a plugin table.
- **Never** write to `audit_logs` or `ticket_status_history` with UPDATE or DELETE.
- **Never** put AI logic in a route handler — it always goes in a BullMQ job.
- **Never** trust `org_id` from request body/params — always use `req.orgId` (set by auth middleware).
- **Never** use `any` in TypeScript without a `// reason: ` comment.
- **Never** use `offset` pagination — use cursor-based.
- **Never** inline prompt strings in source files — prompts live in `/prompts/`.
- **Never** auto-apply an AI suggestion — they are always `pending` until a human approves.
- **Never** create a migration that adds a `NOT NULL` column without a default to an existing table.
- **Never** use `console.log` — use the pino logger.

---

## Environment Variables

```env
# Core
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
APP_URL=https://...

# AI
ANTHROPIC_API_KEY=...

# Email
RESEND_API_KEY=...
FROM_EMAIL=notifications@yourdomain.com

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=oias-attachments

# Optional (plugin-specific)
HUBSPOT_CLIENT_SECRET=...   # crm_sync plugin
WHATSAPP_API_TOKEN=...      # whatsapp_intake plugin
```

---

## Reference Documents

| Document | Location |
|----------|----------|
| Product Requirements (PRD) | `docs/OIAS_PRD.md` |
| Database Schema | `docs/OIAS_schema.sql` |
| Tech Stack Rationale | `docs/OIAS_TechStack.md` |
| OpenAPI Spec | `apps/api/openapi.json` (auto-generated) |
| Plugin Manifest Interface | `packages/types/src/plugin.ts` |
| Audit Action Enum | `packages/types/src/audit.ts` |
