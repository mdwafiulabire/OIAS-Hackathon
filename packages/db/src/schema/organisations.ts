import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const organisations = pgTable(
  'organisations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    plan: text('plan').notNull().default('lite'),
    timezone: text('timezone').notNull().default('UTC'),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_organisations_slug').on(t.slug)],
);
