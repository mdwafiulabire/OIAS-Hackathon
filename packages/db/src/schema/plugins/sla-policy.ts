import { pgTable, uuid, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { tickets } from '../tickets.js';
import { ticketPriorityEnum } from '../tickets.js';

export const pluginSlaPolicies = pgTable('plugin_sla_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priority: text('priority', { enum: ticketPriorityEnum }).notNull(),
  responseMinutes: integer('response_minutes').notNull(),
  resolutionMinutes: integer('resolution_minutes').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pluginSlaTickets = pgTable(
  'plugin_sla_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .unique()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => pluginSlaPolicies.id),
    responseDueAt: timestamp('response_due_at', { withTimezone: true }).notNull(),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }).notNull(),
    firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    responseBreached: boolean('response_breached').notNull().default(false),
    resolutionBreached: boolean('resolution_breached').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_sla_tickets_breach').on(t.orgId, t.resolutionDueAt)],
);
