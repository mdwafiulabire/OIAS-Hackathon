import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { users } from './users.js';

export const notificationChannelEnum = ['in_app', 'email', 'sms', 'webhook'] as const;
export const notificationStatusEnum = ['pending', 'sent', 'failed'] as const;

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: notificationChannelEnum }).notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    status: text('status', { enum: notificationStatusEnum }).notNull().default('pending'),
    relatedType: text('related_type'),
    relatedId: uuid('related_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notif_user').on(t.userId, t.createdAt),
    index('idx_notif_status').on(t.status),
  ],
);
