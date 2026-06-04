import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireRole, requireAdmin } from '../auth/rbac.js';
import { apiResponse, paginatedResponse } from '../../../shared/response.js';
import { createUserSchema, updateUserSchema, cursorPaginationSchema } from '@oias/types';
import { createUser, getUserById, listUsers, updateUser, deactivateUser } from './users.service.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // POST /api/v1/users — create user (admin only)
  app.post('/', {
    preHandler: [requireAdmin()],
    handler: async (request, reply) => {
      const data = createUserSchema.parse(request.body);
      const user = await createUser(app.db, request.orgId, request.userId, data, request.ip);

      app.eventBus.emit('user.created', {
        orgId: request.orgId,
        entityType: 'user',
        entityId: user.id,
        actorId: request.userId,
        timestamp: new Date(),
      });

      return reply.status(201).send(apiResponse(request, user));
    },
  });

  // GET /api/v1/users — list users
  app.get('/', async (request) => {
    const pagination = cursorPaginationSchema.parse(request.query);
    const result = await listUsers(app.db, request.orgId, pagination);
    return paginatedResponse(request, result.data, result.nextCursor);
  });

  // GET /api/v1/users/:id — get single user
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const user = await getUserById(app.db, request.orgId, id);
    return apiResponse(request, user);
  });

  // PATCH /api/v1/users/:id — update user (admin only)
  app.patch('/:id', {
    preHandler: [requireAdmin()],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const data = updateUserSchema.parse(request.body);
      const user = await updateUser(app.db, request.orgId, id, request.userId, data, request.ip);
      return apiResponse(request, user);
    },
  });

  // DELETE /api/v1/users/:id — deactivate user (admin only)
  app.delete('/:id', {
    preHandler: [requireAdmin()],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const user = await deactivateUser(app.db, request.orgId, id, request.userId, request.ip);

      app.eventBus.emit('user.deactivated', {
        orgId: request.orgId,
        entityType: 'user',
        entityId: id,
        actorId: request.userId,
        timestamp: new Date(),
      });

      return apiResponse(request, user);
    },
  });
}
