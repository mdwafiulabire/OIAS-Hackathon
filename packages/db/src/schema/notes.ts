import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { tickets } from './tickets.js';
import { users } from './users.js';

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(true),
    isAiGenerated: boolean('is_ai_generated').notNull().default(false),
    aiApprovedBy: uuid('ai_approved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_notes_ticket').on(t.ticketId, t.createdAt)],
);
