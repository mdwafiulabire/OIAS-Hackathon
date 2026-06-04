import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { tickets } from '../tickets.js';
import { users } from '../users.js';

export const pluginDueDatesEntries = pgTable(
  'plugin_due_dates_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .unique()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_dd_org_due').on(t.orgId, t.dueAt)],
);
