/**
 * Seed script — inserts demo data for local development.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING via Drizzle's `.onConflictDoNothing()`.
 * Run: pnpm db:seed
 *
 * Demo credentials (DEV ONLY — never use in production):
 *   admin@acme.test   / password123
 *   manager@acme.test / password123
 *   agent@acme.test   / password123
 *   viewer@acme.test  / password123
 *
 * Password hash below is bcrypt of "password123" with 10 rounds.
 * Better Auth stores passwords in the `account` table (providerId = 'credential'),
 * but this seed targets the OIAS `users` table for RBAC — the `password_hash`
 * field there is informational; actual auth goes through Better Auth's `account` table.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

// Load .env from monorepo root (Node 22+ built-in, no dotenv dep).
const envPath = resolve(import.meta.dirname, '../../../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Deterministic UUIDs so re-runs are truly idempotent
const ORG_ID = '38394337-9aff-503a-b737-e711338283d4'; // uuid v5(dns, 'acme')

const USER_IDS = {
  admin: 'a0000000-0000-4000-8000-000000000001',
  manager: 'a0000000-0000-4000-8000-000000000002',
  agent: 'a0000000-0000-4000-8000-000000000003',
  viewer: 'a0000000-0000-4000-8000-000000000004',
} as const;

const CAT_IDS = {
  support: 'c0000000-0000-4000-8000-000000000001',
  bug: 'c0000000-0000-4000-8000-000000000002',
  feature: 'c0000000-0000-4000-8000-000000000003',
} as const;

const TICKET_IDS = {
  t1: 'b0000000-0000-4000-8000-000000000001',
  t2: 'b0000000-0000-4000-8000-000000000002',
  t3: 'b0000000-0000-4000-8000-000000000003',
  t4: 'b0000000-0000-4000-8000-000000000004',
  t5: 'b0000000-0000-4000-8000-000000000005',
} as const;

// bcrypt hash of "password123" with cost factor 10 — dev only
const DEV_PASSWORD_HASH =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Seeding demo data…');

  // 1. Organisation
  await db
    .insert(schema.organisations)
    .values({
      id: ORG_ID,
      slug: 'acme',
      name: 'Acme Operations',
      plan: 'lite',
    })
    .onConflictDoNothing();

  console.log('  org: Acme Operations');

  // 2. Users (4 roles)
  await db
    .insert(schema.users)
    .values([
      {
        id: USER_IDS.admin,
        orgId: ORG_ID,
        email: 'admin@acme.test',
        fullName: 'Alice Admin',
        role: 'admin',
        passwordHash: DEV_PASSWORD_HASH,
        isActive: true,
      },
      {
        id: USER_IDS.manager,
        orgId: ORG_ID,
        email: 'manager@acme.test',
        fullName: 'Bob Manager',
        role: 'manager',
        passwordHash: DEV_PASSWORD_HASH,
        isActive: true,
      },
      {
        id: USER_IDS.agent,
        orgId: ORG_ID,
        email: 'agent@acme.test',
        fullName: 'Carol Agent',
        role: 'agent',
        passwordHash: DEV_PASSWORD_HASH,
        isActive: true,
      },
      {
        id: USER_IDS.viewer,
        orgId: ORG_ID,
        email: 'viewer@acme.test',
        fullName: 'Dave Viewer',
        role: 'viewer',
        passwordHash: DEV_PASSWORD_HASH,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  console.log('  users: 4 (admin, manager, agent, viewer)');

  // 3. Categories
  await db
    .insert(schema.categories)
    .values([
      {
        id: CAT_IDS.support,
        orgId: ORG_ID,
        name: 'Support',
        color: '#3B82F6',
        sortOrder: 1,
      },
      {
        id: CAT_IDS.bug,
        orgId: ORG_ID,
        name: 'Bug Report',
        color: '#EF4444',
        sortOrder: 2,
      },
      {
        id: CAT_IDS.feature,
        orgId: ORG_ID,
        name: 'Feature Request',
        color: '#10B981',
        sortOrder: 3,
      },
    ])
    .onConflictDoNothing();

  console.log('  categories: 3 (Support, Bug Report, Feature Request)');

  // 4. Tickets (5 with varied status, assignees, categories)
  await db
    .insert(schema.tickets)
    .values([
      {
        id: TICKET_IDS.t1,
        orgId: ORG_ID,
        refNumber: 'ACME-001',
        title: 'Cannot log in to the portal',
        description: 'User reports 401 on every login attempt since yesterday.',
        type: 'case',
        status: 'new',
        priority: 'high',
        categoryId: CAT_IDS.support,
        assigneeId: USER_IDS.agent,
        createdBy: USER_IDS.admin,
      },
      {
        id: TICKET_IDS.t2,
        orgId: ORG_ID,
        refNumber: 'ACME-002',
        title: 'Dashboard crashes on mobile',
        description: 'White screen on iOS Safari 17 when opening the dashboard widget.',
        type: 'incident',
        status: 'in_progress',
        priority: 'urgent',
        categoryId: CAT_IDS.bug,
        assigneeId: USER_IDS.agent,
        createdBy: USER_IDS.manager,
      },
      {
        id: TICKET_IDS.t3,
        orgId: ORG_ID,
        refNumber: 'ACME-003',
        title: 'Add CSV export for ticket list',
        description: 'Operations team needs to export ticket lists to Excel weekly.',
        type: 'request',
        status: 'assigned',
        priority: 'medium',
        categoryId: CAT_IDS.feature,
        assigneeId: null,
        createdBy: USER_IDS.manager,
      },
      {
        id: TICKET_IDS.t4,
        orgId: ORG_ID,
        refNumber: 'ACME-004',
        title: 'Email notifications delayed by 2 hours',
        description: 'Investigated and traced to SMTP rate-limit misconfiguration.',
        type: 'case',
        status: 'resolved',
        priority: 'medium',
        categoryId: CAT_IDS.support,
        assigneeId: USER_IDS.agent,
        createdBy: USER_IDS.admin,
        resolvedAt: new Date('2026-05-25T14:00:00Z'),
      },
      {
        id: TICKET_IDS.t5,
        orgId: ORG_ID,
        refNumber: 'ACME-005',
        title: 'Onboarding guide PDF link broken',
        description: 'Link in welcome email returns 404. Updated R2 path corrects it.',
        type: 'request',
        status: 'closed',
        priority: 'low',
        categoryId: CAT_IDS.support,
        assigneeId: USER_IDS.agent,
        createdBy: USER_IDS.viewer,
        resolvedAt: new Date('2026-05-24T09:00:00Z'),
        closedAt: new Date('2026-05-24T10:30:00Z'),
      },
    ])
    .onConflictDoNothing();

  console.log('  tickets: 5 (new×1, assigned×1, in_progress×1, resolved×1, closed×1)');

  // 5. Plugins enabled for the demo org (Reasoning Agents track demo).
  await db
    .insert(schema.pluginRegistry)
    .values([
      {
        orgId: ORG_ID,
        pluginKey: 'ai_triage',
        isEnabled: true,
        config: {},
        enabledAt: new Date(),
        enabledBy: USER_IDS.admin,
      },
      {
        orgId: ORG_ID,
        pluginKey: 'due_dates',
        isEnabled: true,
        config: {},
        enabledAt: new Date(),
        enabledBy: USER_IDS.admin,
      },
    ])
    .onConflictDoNothing();

  console.log('  plugins enabled: ai_triage, due_dates');

  await client.end();
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
