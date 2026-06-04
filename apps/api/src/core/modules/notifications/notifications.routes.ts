import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth.middleware.js';
import { apiResponse, paginatedResponse } from '../../../shared/response.js';
import { cursorPaginationSchema } from '@oias/types';
import { listUserNotifications } from './notifications.service.js';
import { notifications } from '@oias/db';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // GET /api/v1/notifications — list current user's notifications
  app.get('/', async (request) => {
    const pagination = cursorPaginationSchema.parse(request.query);
    const result = await listUserNotifications(app.db, request.orgId, request.userId, pagination);
    return paginatedResponse(request, result.data, result.nextCursor);
  });

  // PATCH /api/v1/notifications/:id/read — mark notification as read
  app.patch('/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    const [updated] = await app.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.orgId, request.orgId),
          eq(notifications.userId, request.userId),
        ),
      )
      .returning();

    return apiResponse(request, updated ?? null);
  });

  // POST /api/v1/notifications/read-all — mark all as read
  app.post('/read-all', async (request) => {
    await app.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.orgId, request.orgId),
          eq(notifications.userId, request.userId),
        ),
      );

    return apiResponse(request, { success: true });
  });
}
