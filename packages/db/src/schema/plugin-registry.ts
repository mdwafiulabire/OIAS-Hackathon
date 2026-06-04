import { pgTable, uuid, text, timestamp, boolean, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';
import { users } from './users.js';

export const pluginRegistry = pgTable(
  'plugin_registry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    pluginKey: text('plugin_key').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    config: jsonb('config').notNull().default({}),
    enabledAt: timestamp('enabled_at', { withTimezone: true }),
    enabledBy: uuid('enabled_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_plugin_per_org').on(t.orgId, t.pluginKey),
    index('idx_plugin_registry').on(t.orgId, t.isEnabled),
  ],
);
