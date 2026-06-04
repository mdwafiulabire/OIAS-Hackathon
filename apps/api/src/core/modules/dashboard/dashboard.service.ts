import { and, eq, isNull, sql, gte, lt, ne, count } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { tickets, users } from '@oias/db';

export async function getDashboardStats(db: Database, orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [newCount] = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(eq(tickets.orgId, orgId), eq(tickets.status, 'new'), isNull(tickets.deletedAt)));

  const [inProgressCount] = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      and(eq(tickets.orgId, orgId), eq(tickets.status, 'in_progress'), isNull(tickets.deletedAt)),
    );

  const [overdueCount] = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        isNull(tickets.deletedAt),
        ne(tickets.status, 'resolved'),
        ne(tickets.status, 'closed'),
        lt(tickets.updatedAt, staleThreshold),
      ),
    );

  const [resolvedTodayCount] = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      and(
        eq(tickets.orgId, orgId),
        eq(tickets.status, 'resolved'),
        gte(tickets.resolvedAt, today),
        isNull(tickets.deletedAt),
      ),
    );

  return {
    totalNew: newCount?.count ?? 0,
    totalInProgress: inProgressCount?.count ?? 0,
    totalOverdue: overdueCount?.count ?? 0,
    resolvedToday: resolvedTodayCount?.count ?? 0,
  };
}

export async function getAgentBacklog(db: Database, orgId: string) {
  const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const rows = await db
    .select({
      assigneeId: tickets.assigneeId,
      assigneeName: users.fullName,
      openTickets: count(),
      highPriority: sql<number>`count(*) filter (where ${tickets.priority} in ('high', 'urgent'))`,
      overdue: sql<number>`count(*) filter (where ${tickets.updatedAt} < ${staleThreshold})`,
    })
    .from(tickets)
    .innerJoin(users, eq(users.id, tickets.assigneeId))
    .where(
      and(
        eq(tickets.orgId, orgId),
        isNull(tickets.deletedAt),
        ne(tickets.status, 'resolved'),
        ne(tickets.status, 'closed'),
        sql`${tickets.assigneeId} IS NOT NULL`,
      ),
    )
    .groupBy(tickets.assigneeId, users.fullName);

  return rows;
}
