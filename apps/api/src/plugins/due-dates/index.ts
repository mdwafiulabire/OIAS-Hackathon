import type { OIASPlugin } from '@oias/types';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { pluginDueDatesEntries } from '@oias/db';
import { apiResponse } from '../../shared/response.js';
import { authMiddleware } from '../../core/modules/auth/auth.middleware.js';
import { z } from 'zod';

const setDueDateSchema = z.object({
  ticketId: z.string().uuid(),
  dueAt: z.string().datetime(),
  remindAt: z.string().datetime().optional(),
});

const plugin: OIASPlugin = {
  key: 'due_dates',
  name: 'Due Dates',
  version: '1.0.0',

  routes: (app: FastifyInstance) => {
    app.addHook('onRequest', authMiddleware);

    // POST /api/v1/plugins/due_dates/ — set due date
    app.post('/', async (request, reply) => {
      const data = setDueDateSchema.parse(request.body);
      const [entry] = await app.db
        .insert(pluginDueDatesEntries)
        .values({
          orgId: request.orgId,
          ticketId: data.ticketId,
          dueAt: new Date(data.dueAt),
          createdBy: request.userId,
        })
        .returning();

      return reply.status(201).send(apiResponse(request, entry));
    });

    // GET /api/v1/plugins/due_dates/:ticketId — get due date for ticket
    app.get('/:ticketId', async (request) => {
      const { ticketId } = request.params as { ticketId: string };
      const [entry] = await app.db
        .select()
        .from(pluginDueDatesEntries)
        .where(
          and(
            eq(pluginDueDatesEntries.ticketId, ticketId),
            eq(pluginDueDatesEntries.orgId, request.orgId),
          ),
        );

      return apiResponse(request, entry ?? null);
    });
  },

  eventHandlers: {
    'ticket.created': async (_payload) => {
      // Future: auto-set default due date based on priority
    },
  },
};

export default plugin;
