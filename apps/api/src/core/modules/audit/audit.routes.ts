import type { FastifyInstance } from 'fastify';
import { and, eq, desc, gt, lt } from 'drizzle-orm';
import { auditLogs } from '@oias/db';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireManager } from '../auth/rbac.js';
import { paginatedResponse } from '../../../shared/response.js';
import { cursorPaginationSchema } from '@oias/types';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', requireManager());

  // GET /api/v1/audit — list audit logs (cursor-paginated)
  app.get('/', async (request, reply) => {
    const { cursor, limit } = cursorPaginationSchema.parse(request.query);

    const conditions = [eq(auditLogs.orgId, request.orgId)];
    if (cursor) {
      conditions.push(lt(auditLogs.id, cursor));
    }

    const rows = await app.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]!.id : null;

    return paginatedResponse(request, data, nextCursor);
  });
}
