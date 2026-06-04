import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { tickets } from '../tickets.js';

export const pluginEmailIntakeMessages = pgTable('plugin_email_intake_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull().unique(),
  fromAddress: text('from_address').notNull(),
  subject: text('subject'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
