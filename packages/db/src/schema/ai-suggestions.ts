import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { tickets } from './tickets.js';
import { users } from './users.js';

export const aiSuggestions = pgTable(
  'ai_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    suggestionType: text('suggestion_type').notNull(),
    payload: jsonb('payload').notNull(),
    modelVersion: text('model_version'),
    status: text('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_ai_sug_ticket').on(t.ticketId, t.createdAt)],
);
