import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.js';
import { apiResponse } from '../../../shared/response.js';
import { getDashboardStats, getAgentBacklog } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // GET /api/v1/dashboard/stats
  app.get('/stats', async (request) => {
    const stats = await getDashboardStats(app.db, request.orgId);
    return apiResponse(request, stats);
  });

  // GET /api/v1/dashboard/backlog — manager+ only
  app.get('/backlog', {
    preHandler: [requireRole('admin', 'manager')],
    handler: async (request) => {
      const backlog = await getAgentBacklog(app.db, request.orgId);
      return apiResponse(request, backlog);
    },
  });
}
