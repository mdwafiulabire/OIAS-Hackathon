import { pgTable, uuid, text, timestamp, jsonb, inet, index } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { users } from './users.js';
import { AUDIT_ACTIONS } from '@oias/types';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action', { enum: AUDIT_ACTIONS }).notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull().default({}),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_audit_org_time').on(t.orgId, t.createdAt),
    index('idx_audit_actor').on(t.orgId, t.actorId, t.createdAt),
    index('idx_audit_entity').on(t.entityType, t.entityId, t.createdAt),
  ],
);
