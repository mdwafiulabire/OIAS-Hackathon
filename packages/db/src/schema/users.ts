import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organisations } from './organisations.js';

export const userRoleEnum = ['admin', 'manager', 'agent', 'viewer'] as const;

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role', { enum: userRoleEnum }).notNull().default('agent'),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('uq_user_email_per_org').on(t.orgId, t.email),
    index('idx_users_org').on(t.orgId),
    index('idx_users_role').on(t.orgId, t.role),
  ],
);
