import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireAdmin } from '../auth/rbac.js';
import { apiResponse } from '../../../shared/response.js';
import {
  getOrganisation,
  updateOrganisation,
  listPlugins,
  togglePlugin,
} from './settings.service.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // GET /api/v1/settings/org — get org info
  app.get('/org', async (request) => {
    const org = await getOrganisation(app.db, request.orgId);
    return apiResponse(request, org);
  });

  // PATCH /api/v1/settings/org — update org (admin only)
  app.patch('/org', {
    preHandler: [requireAdmin()],
    handler: async (request) => {
      const data = z
        .object({
          name: z.string().min(1).max(255).optional(),
          slug: z
            .string()
            .min(2)
            .max(60)
            .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, and dashes only')
            .optional(),
          plan: z.enum(['lite', 'lite_plus', 'advanced']).optional(),
          timezone: z.string().max(100).optional(),
        })
        .parse(request.body);
      const org = await updateOrganisation(app.db, request.orgId, data);
      return apiResponse(request, org);
    },
  });

  // GET /api/v1/settings/plugins — list plugins for org
  app.get('/plugins', async (request) => {
    const plugins = await listPlugins(app.db, request.orgId);
    return apiResponse(request, plugins);
  });

  // PATCH /api/v1/settings/plugins/:id — toggle plugin (admin only)
  app.patch('/plugins/:id', {
    preHandler: [requireAdmin()],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const data = z.object({ isEnabled: z.boolean() }).parse(request.body);
      const plugin = await togglePlugin(app.db, request.orgId, id, data.isEnabled, request.userId);
      return apiResponse(request, plugin);
    },
  });
}
