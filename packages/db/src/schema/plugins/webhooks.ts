import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';

export const pluginWebhookEndpoints = pgTable('plugin_webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').array().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pluginWebhookDeliveries = pgTable(
  'plugin_webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => pluginWebhookEndpoints.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_wh_delivery_pending').on(t.nextAttemptAt)],
);
