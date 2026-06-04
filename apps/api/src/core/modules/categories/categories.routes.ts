import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireAdmin } from '../auth/rbac.js';
import { apiResponse } from '../../../shared/response.js';
import { createCategorySchema } from '@oias/types';
import {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deactivateCategory,
} from './categories.service.js';

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // POST /api/v1/categories — create category (admin only)
  app.post('/', {
    preHandler: [requireAdmin()],
    handler: async (request, reply) => {
      const data = createCategorySchema.parse(request.body);
      const category = await createCategory(app.db, request.orgId, data);
      return reply.status(201).send(apiResponse(request, category));
    },
  });

  // GET /api/v1/categories — list categories
  app.get('/', async (request) => {
    const list = await listCategories(app.db, request.orgId);
    return apiResponse(request, list);
  });

  // GET /api/v1/categories/:id — get single category
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const category = await getCategoryById(app.db, request.orgId, id);
    return apiResponse(request, category);
  });

  // PATCH /api/v1/categories/:id — update category (admin only)
  app.patch('/:id', {
    preHandler: [requireAdmin()],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const data = createCategorySchema.partial().parse(request.body);
      const category = await updateCategory(app.db, request.orgId, id, data);
      return apiResponse(request, category);
    },
  });

  // DELETE /api/v1/categories/:id — deactivate category (admin only)
  app.delete('/:id', {
    preHandler: [requireAdmin()],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await deactivateCategory(app.db, request.orgId, id);
      return reply.status(204).send();
    },
  });
}
