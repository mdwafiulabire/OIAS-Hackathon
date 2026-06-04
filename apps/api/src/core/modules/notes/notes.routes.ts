import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.js';
import { apiResponse, paginatedResponse } from '../../../shared/response.js';
import { createNoteSchema, cursorPaginationSchema } from '@oias/types';
import { createNote, listNotes } from './notes.service.js';

export async function noteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // POST /api/v1/tickets/:ticketId/notes — add note
  app.post('/:ticketId/notes', {
    preHandler: [requireRole('admin', 'manager', 'agent')],
    handler: async (request, reply) => {
      const { ticketId } = request.params as { ticketId: string };
      const data = createNoteSchema.parse(request.body);
      const note = await createNote(app.db, request.orgId, ticketId, request.userId, data, request.ip);

      app.eventBus.emit('note.created', {
        orgId: request.orgId,
        entityType: 'note',
        entityId: note.id,
        actorId: request.userId,
        data: { ticketId },
        timestamp: new Date(),
      });

      return reply.status(201).send(apiResponse(request, note));
    },
  });

  // GET /api/v1/tickets/:ticketId/notes — list notes
  app.get('/:ticketId/notes', async (request) => {
    const { ticketId } = request.params as { ticketId: string };
    const pagination = cursorPaginationSchema.parse(request.query);
    const result = await listNotes(app.db, request.orgId, ticketId, pagination);
    return paginatedResponse(request, result.data, result.nextCursor);
  });
}
