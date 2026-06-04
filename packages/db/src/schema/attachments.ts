import { pgTable, uuid, text, timestamp, bigint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organisations } from './organisations.js';
import { tickets } from './tickets.js';
import { notes } from './notes.js';
import { users } from './users.js';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
    noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    fileName: text('file_name').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    mimeType: text('mime_type'),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'att_parent_check',
      sql`(${t.ticketId} IS NOT NULL AND ${t.noteId} IS NULL) OR (${t.ticketId} IS NULL AND ${t.noteId} IS NOT NULL)`,
    ),
  ],
);
