import { and, eq, desc, lt, isNull, sql, ilike, or } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { tickets, ticketStatusHistory, ticketAssignments } from '@oias/db';
import type { CreateTicket, UpdateTicket, TicketStatus, TicketFilter, CursorPagination } from '@oias/types';
import { NotFoundError, InvalidTransitionError, DEFAULT_STATUS_TRANSITIONS } from '@oias/types';
import { auditLog } from '../audit/audit.service.js';

function generateRefNumber(seq: number): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `TKT-${ym}-${String(seq).padStart(5, '0')}`;
}

export async function createTicket(
  db: Database,
  orgId: string,
  userId: string,
  data: CreateTicket,
  ip?: string,
) {
  // Get next sequence number for this org
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tickets)
    .where(eq(tickets.orgId, orgId));
  const seq = (countResult[0]?.count ?? 0) + 1;
  const refNumber = generateRefNumber(seq);

  const [ticket] = await db
    .insert(tickets)
    .values({
      orgId,
      refNumber,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      categoryId: data.categoryId,
      assigneeId: data.assigneeId,
      createdBy: userId,
      customFields: data.customFields,
      metadata: data.metadata,
    })
    .returning();

  // Record initial status
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket!.id,
    fromStatus: null,
    toStatus: 'new',
    actorId: userId,
  });

  // If assigned on creation, record assignment
  if (data.assigneeId) {
    await db.insert(ticketAssignments).values({
      ticketId: ticket!.id,
      fromUserId: null,
      toUserId: data.assigneeId,
      assignedBy: userId,
    });
  }

  await auditLog(db, {
    orgId,
    actorId: userId,
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket!.id,
    payload: { refNumber, title: data.title },
    ipAddress: ip,
  });

  return ticket!;
}

export async function getTicketById(db: Database, orgId: string, ticketId: string) {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId), isNull(tickets.deletedAt)));

  if (!ticket) throw new NotFoundError('ticket', ticketId);
  return ticket;
}

export async function listTickets(
  db: Database,
  orgId: string,
  filters: TicketFilter,
  pagination: CursorPagination,
) {
  const conditions = [eq(tickets.orgId, orgId), isNull(tickets.deletedAt)];

  if (filters.status) conditions.push(eq(tickets.status, filters.status));
  if (filters.priority) conditions.push(eq(tickets.priority, filters.priority));
  if (filters.assigneeId) conditions.push(eq(tickets.assigneeId, filters.assigneeId));
  if (filters.categoryId) conditions.push(eq(tickets.categoryId, filters.categoryId));
  if (filters.search) {
    conditions.push(
      or(ilike(tickets.title, `%${filters.search}%`), ilike(tickets.refNumber, `%${filters.search}%`))!,
    );
  }
  if (pagination.cursor) conditions.push(lt(tickets.id, pagination.cursor));

  const rows = await db
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const data = hasMore ? rows.slice(0, pagination.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  return { data, nextCursor };
}

export async function updateTicket(
  db: Database,
  orgId: string,
  ticketId: string,
  userId: string,
  data: UpdateTicket,
  ip?: string,
) {
  const existing = await getTicketById(db, orgId, ticketId);

  const [updated] = await db
    .update(tickets)
    .set({
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type && { type: data.type }),
      ...(data.priority && { priority: data.priority }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.customFields && { customFields: data.customFields }),
      ...(data.metadata && { metadata: data.metadata }),
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning();

  await auditLog(db, {
    orgId,
    actorId: userId,
    action: 'ticket.updated',
    entityType: 'ticket',
    entityId: ticketId,
    payload: { before: existing, after: updated },
    ipAddress: ip,
  });

  return updated!;
}

export async function changeTicketStatus(
  db: Database,
  orgId: string,
  ticketId: string,
  userId: string,
  newStatus: TicketStatus,
  reason?: string,
  ip?: string,
) {
  const ticket = await getTicketById(db, orgId, ticketId);
  const oldStatus = ticket.status as TicketStatus;

  // Validate transition
  const allowed = DEFAULT_STATUS_TRANSITIONS[oldStatus];
  if (!allowed.includes(newStatus)) {
    throw new InvalidTransitionError(oldStatus, newStatus);
  }

  // Calculate duration in previous status
  const lastHistory = await db
    .select()
    .from(ticketStatusHistory)
    .where(eq(ticketStatusHistory.ticketId, ticketId))
    .orderBy(desc(ticketStatusHistory.createdAt))
    .limit(1);

  const durationSeconds = lastHistory[0]
    ? Math.floor((Date.now() - lastHistory[0].createdAt.getTime()) / 1000)
    : null;

  // Update ticket status
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'resolved') updateData.resolvedAt = new Date();
  if (newStatus === 'closed') updateData.closedAt = new Date();

  const [updated] = await db
    .update(tickets)
    .set(updateData)
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning();

  // Record in history
  await db.insert(ticketStatusHistory).values({
    ticketId,
    fromStatus: oldStatus,
    toStatus: newStatus,
    actorId: userId,
    reason,
    durationSeconds,
  });

  await auditLog(db, {
    orgId,
    actorId: userId,
    action: 'ticket.status_changed',
    entityType: 'ticket',
    entityId: ticketId,
    payload: { before: { status: oldStatus }, after: { status: newStatus } },
    ipAddress: ip,
  });

  return updated!;
}

export async function assignTicket(
  db: Database,
  orgId: string,
  ticketId: string,
  userId: string,
  assigneeId: string | null,
  reason?: string,
  ip?: string,
) {
  const ticket = await getTicketById(db, orgId, ticketId);
  const previousAssignee = ticket.assigneeId;

  const [updated] = await db
    .update(tickets)
    .set({ assigneeId })
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
    .returning();

  await db.insert(ticketAssignments).values({
    ticketId,
    fromUserId: previousAssignee,
    toUserId: assigneeId,
    assignedBy: userId,
    reason,
  });

  const action = previousAssignee ? 'ticket.reassigned' : 'ticket.assigned';
  await auditLog(db, {
    orgId,
    actorId: userId,
    action,
    entityType: 'ticket',
    entityId: ticketId,
    payload: { from: previousAssignee, to: assigneeId, reason },
    ipAddress: ip,
  });

  return updated!;
}

export async function getTicketHistory(db: Database, orgId: string, ticketId: string) {
  // Verify ticket belongs to org
  await getTicketById(db, orgId, ticketId);

  return db
    .select()
    .from(ticketStatusHistory)
    .where(eq(ticketStatusHistory.ticketId, ticketId))
    .orderBy(desc(ticketStatusHistory.createdAt));
}
