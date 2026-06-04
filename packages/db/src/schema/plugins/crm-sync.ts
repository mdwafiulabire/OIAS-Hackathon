import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organisations } from '../organisations.js';
import { tickets } from '../tickets.js';

export const pluginCrmSyncMappings = pgTable(
  'plugin_crm_sync_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    crmProvider: text('crm_provider').notNull(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    crmRecordType: text('crm_record_type').notNull(),
    crmRecordId: text('crm_record_id').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    syncError: text('sync_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_crm_ticket').on(t.ticketId, t.crmProvider, t.crmRecordType)],
);
