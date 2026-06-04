import { pgTable, uuid, timestamp, integer, numeric, text, date, unique } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { users } from '../users.js';

export const pluginScorecardSnapshots = pgTable(
  'plugin_scorecard_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    ticketsResolved: integer('tickets_resolved').notNull().default(0),
    avgResolutionHours: numeric('avg_resolution_hours', { precision: 8, scale: 2 }),
    slaCompliancePct: numeric('sla_compliance_pct', { precision: 5, scale: 2 }),
    qualityScore: numeric('quality_score', { precision: 5, scale: 2 }),
    grade: text('grade'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_scorecard_user_period').on(t.userId, t.periodStart)],
);
