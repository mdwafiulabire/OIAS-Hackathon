import { pgTable, uuid, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { tickets } from '../tickets.js';
import { users } from '../users.js';

export const pluginSubtasks = pgTable(
  'plugin_subtasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_subtasks_ticket').on(t.ticketId, t.sortOrder)],
);
