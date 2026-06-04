import { and, eq, desc, lt } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { notifications } from '@oias/db';
import type { CreateNotification, CursorPagination } from '@oias/types';

export async function createNotification(db: Database, orgId: string, data: CreateNotification) {
  const [notification] = await db
    .insert(notifications)
    .values({
      orgId,
      userId: data.userId,
      channel: data.channel,
      subject: data.subject,
      body: data.body,
      relatedType: data.relatedType,
      relatedId: data.relatedId,
    })
    .returning();

  return notification!;
}

export async function listUserNotifications(
  db: Database,
  orgId: string,
  userId: string,
  pagination: CursorPagination,
) {
  const conditions = [eq(notifications.orgId, orgId), eq(notifications.userId, userId)];
  if (pagination.cursor) conditions.push(lt(notifications.id, pagination.cursor));

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const data = hasMore ? rows.slice(0, pagination.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  return { data, nextCursor };
}
