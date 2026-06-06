/**
 * Bootstrap script — creates a working demo login + demo data.
 *
 * Why this exists instead of the old packages/db/src/seed.ts:
 *   The previous seed wrote rows into the OIAS `users` table directly with a
 *   bcrypt hash. Better Auth doesn't know about that table — it authenticates
 *   against its own `user` + `account` tables and uses its own hasher. So those
 *   seed users could never actually log in.
 *
 * This script:
 *   1. Signs up admin@acme.test / password123 via Better Auth's server API,
 *      which transparently hashes the password and triggers the user.create
 *      after-hook (creating the organisations + OIAS users rows).
 *   2. Reads back the freshly-created org id + admin user id.
 *   3. Inserts categories, demo tickets, and plugin_registry rows scoped to
 *      that org id.
 *
 * Idempotent: signUp throws on duplicate email and we swallow it; all inserts
 * use onConflictDoNothing.
 *
 * Run inside the docker-compose db-init service or locally with:
 *   pnpm --filter @oias/api bootstrap
 */

import { and, eq } from 'drizzle-orm';
import {
  categories as categoriesTable,
  pluginRegistry,
  tickets as ticketsTable,
  ticketStatusHistory,
  users as oiasUsersTable,
} from '@oias/db';
import { env } from '../env.js';
import { createDb } from '@oias/db';
import { auth } from '../core/modules/auth/auth.js';

const ADMIN_EMAIL = 'admin@acme.test';
const ADMIN_PASSWORD = 'password123';
const ADMIN_NAME = 'Alice Admin';
const ORG_NAME = 'Acme Operations';

async function main() {
  const db = createDb(env.DATABASE_URL);

  // 1. Sign up the demo admin via Better Auth.
  try {
    await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
        // reason: read by the user.create after-hook in auth.ts
        organisationName: ORG_NAME,
      } as never,
    });
    console.log(`bootstrap: signed up ${ADMIN_EMAIL}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already') || msg.includes('exists') || msg.includes('USER_ALREADY')) {
      console.log(`bootstrap: ${ADMIN_EMAIL} already exists — continuing`);
    } else {
      throw err;
    }
  }

  // 2. Look up the org + admin row the auth hook created.
  const [admin] = await db
    .select()
    .from(oiasUsersTable)
    .where(eq(oiasUsersTable.email, ADMIN_EMAIL))
    .limit(1);

  if (!admin) {
    throw new Error(
      `bootstrap: ${ADMIN_EMAIL} not found in oias users — auth signup may have failed silently`,
    );
  }

  const orgId = admin.orgId;
  const adminUserId = admin.id;
  console.log(`bootstrap: org=${orgId} adminUser=${adminUserId}`);

  // Ensure admin role (the hook sets role='admin' for the first user, but be defensive).
  await db
    .update(oiasUsersTable)
    .set({ role: 'admin' })
    .where(eq(oiasUsersTable.id, adminUserId));

  // 3. Categories.
  await db
    .insert(categoriesTable)
    .values([
      { orgId, name: 'Support', color: '#3B82F6', sortOrder: 1 },
      { orgId, name: 'Bug Report', color: '#EF4444', sortOrder: 2 },
      { orgId, name: 'Feature Request', color: '#10B981', sortOrder: 3 },
    ])
    .onConflictDoNothing();

  const cats = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.orgId, orgId));
  const supportCat = cats.find((c) => c.name === 'Support');
  const bugCat = cats.find((c) => c.name === 'Bug Report');
  const featureCat = cats.find((c) => c.name === 'Feature Request');
  console.log(`  categories: ${cats.length}`);

  // 4. Demo tickets (only if this org has none yet).
  const existingTickets = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(eq(ticketsTable.orgId, orgId))
    .limit(1);

  if (existingTickets.length === 0) {
    const inserted = await db
      .insert(ticketsTable)
      .values([
        {
          orgId,
          refNumber: 'ACME-001',
          title: 'Cannot log in to the portal',
          description: 'User reports 401 on every login attempt since yesterday.',
          type: 'case',
          status: 'new',
          priority: 'high',
          categoryId: supportCat?.id,
          assigneeId: adminUserId,
          createdBy: adminUserId,
        },
        {
          orgId,
          refNumber: 'ACME-002',
          title: 'Dashboard crashes on mobile',
          description: 'White screen on iOS Safari 17 when opening the dashboard widget.',
          type: 'incident',
          status: 'in_progress',
          priority: 'urgent',
          categoryId: bugCat?.id,
          assigneeId: adminUserId,
          createdBy: adminUserId,
        },
        {
          orgId,
          refNumber: 'ACME-003',
          title: 'Add CSV export for ticket list',
          description: 'Operations team needs to export ticket lists to Excel weekly.',
          type: 'request',
          status: 'assigned',
          priority: 'medium',
          categoryId: featureCat?.id,
          createdBy: adminUserId,
        },
        {
          orgId,
          refNumber: 'ACME-004',
          title: 'Email notifications delayed by 2 hours',
          description: 'Investigated and traced to SMTP rate-limit misconfiguration.',
          type: 'case',
          status: 'resolved',
          priority: 'medium',
          categoryId: supportCat?.id,
          assigneeId: adminUserId,
          createdBy: adminUserId,
          resolvedAt: new Date('2026-05-25T14:00:00Z'),
        },
        {
          orgId,
          refNumber: 'ACME-005',
          title: 'Onboarding guide PDF link broken',
          description: 'Link in welcome email returns 404. Updated R2 path corrects it.',
          type: 'request',
          status: 'closed',
          priority: 'low',
          categoryId: supportCat?.id,
          assigneeId: adminUserId,
          createdBy: adminUserId,
          resolvedAt: new Date('2026-05-24T09:00:00Z'),
          closedAt: new Date('2026-05-24T10:30:00Z'),
        },
      ])
      .returning({ id: ticketsTable.id });

    // Initial status history rows.
    for (const t of inserted) {
      await db.insert(ticketStatusHistory).values({
        ticketId: t.id,
        fromStatus: null,
        toStatus: 'new',
        actorId: adminUserId,
      });
    }
    console.log(`  tickets: ${inserted.length}`);
  } else {
    console.log('  tickets: already seeded — skipping');
  }

  // 5. Enable plugins for this org.
  await db
    .insert(pluginRegistry)
    .values([
      {
        orgId,
        pluginKey: 'ai_triage',
        isEnabled: true,
        config: {},
        enabledAt: new Date(),
        enabledBy: adminUserId,
      },
      {
        orgId,
        pluginKey: 'due_dates',
        isEnabled: true,
        config: {},
        enabledAt: new Date(),
        enabledBy: adminUserId,
      },
    ])
    .onConflictDoNothing();
  console.log('  plugins enabled: ai_triage, due_dates');

  console.log('bootstrap complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('bootstrap failed:', err);
  process.exit(1);
});

// Silence the unused-import lint for `and` which we keep for future filters.
void and;
