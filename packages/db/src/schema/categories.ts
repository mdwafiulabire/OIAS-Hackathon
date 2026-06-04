import { pgTable, uuid, text, timestamp, boolean, integer, unique } from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('uq_category_per_org').on(t.orgId, t.name)],
);
