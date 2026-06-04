import { and, eq, isNull, desc, lt } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { notes } from '@oias/db';
import type { CreateNote, CursorPagination } from '@oias/types';
import { NotFoundError } from '@oias/types';
import { auditLog } from '../audit/audit.service.js';

export async function createNote(
  db: Database,
  orgId: string,
  ticketId: string,
  userId: string,
  data: CreateNote,
  ip?: string,
) {
  const [note] = await db
    .insert(notes)
    .values({
      orgId,
      ticketId,
      authorId: userId,
      body: data.body,
      isInternal: data.isInternal,
    })
    .returning();

  await auditLog(db, {
    orgId,
    actorId: userId,
    action: 'note.created',
    entityType: 'note',
    entityId: note!.id,
    payload: { ticketId, isInternal: data.isInternal },
    ipAddress: ip,
  });

  return note!;
}

export async function listNotes(
  db: Database,
  orgId: string,
  ticketId: string,
  pagination: CursorPagination,
) {
  const conditions = [
    eq(notes.orgId, orgId),
    eq(notes.ticketId, ticketId),
    isNull(notes.deletedAt),
  ];
  if (pagination.cursor) conditions.push(lt(notes.id, pagination.cursor));

  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.createdAt))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const data = hasMore ? rows.slice(0, pagination.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  return { data, nextCursor };
}
