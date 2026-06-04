import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { users } from './users.js';
import { categories } from './categories.js';
import { teams } from './teams.js';

export const ticketStatusEnum = ['new', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export const ticketPriorityEnum = ['low', 'medium', 'high', 'urgent'] as const;
export const ticketTypeEnum = ['request', 'lead', 'case', 'incident'] as const;

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    refNumber: text('ref_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type', { enum: ticketTypeEnum }).notNull().default('request'),
    status: text('status', { enum: ticketStatusEnum }).notNull().default('new'),
    priority: text('priority', { enum: ticketPriorityEnum }).notNull().default('medium'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    customFields: jsonb('custom_fields').notNull().default({}),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('uq_ticket_ref_per_org').on(t.orgId, t.refNumber),
    index('idx_tickets_org_status').on(t.orgId, t.status),
    index('idx_tickets_assignee').on(t.orgId, t.assigneeId),
    index('idx_tickets_created').on(t.orgId, t.createdAt),
    index('idx_tickets_category').on(t.orgId, t.categoryId),
  ],
);

export const ticketStatusHistory = pgTable(
  'ticket_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status', { enum: ticketStatusEnum }),
    toStatus: text('to_status', { enum: ticketStatusEnum }).notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    durationSeconds: integer('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_tsh_ticket').on(t.ticketId, t.createdAt)],
);

export const ticketAssignments = pgTable(
  'ticket_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id').references(() => users.id, { onDelete: 'set null' }),
    toUserId: uuid('to_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_ta_ticket').on(t.ticketId, t.createdAt)],
);
