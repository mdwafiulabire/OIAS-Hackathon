import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireRole } from '../auth/rbac.js';
import { apiResponse, paginatedResponse } from '../../../shared/response.js';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  assignTicketSchema,
  ticketFilterSchema,
  cursorPaginationSchema,
} from '@oias/types';
import {
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
  changeTicketStatus,
  assignTicket,
  getTicketHistory,
} from './tickets.service.js';

export async function ticketRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // POST /api/v1/tickets — create ticket
  app.post('/', {
    preHandler: [requireRole('admin', 'manager', 'agent')],
    handler: async (request, reply) => {
      const data = createTicketSchema.parse(request.body);
      const ticket = await createTicket(app.db, request.orgId, request.userId, data, request.ip);

      app.eventBus.emit('ticket.created', {
        orgId: request.orgId,
        entityType: 'ticket',
        entityId: ticket.id,
        actorId: request.userId,
        data: ticket as unknown as Record<string, unknown>,
        timestamp: new Date(),
      });

      return reply.status(201).send(apiResponse(request, ticket));
    },
  });

  // GET /api/v1/tickets — list tickets
  app.get('/', async (request) => {
    const filters = ticketFilterSchema.parse(request.query);
    const pagination = cursorPaginationSchema.parse(request.query);
    const result = await listTickets(app.db, request.orgId, filters, pagination);
    return paginatedResponse(request, result.data, result.nextCursor);
  });

  // GET /api/v1/tickets/:id — get single ticket
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const ticket = await getTicketById(app.db, request.orgId, id);
    return apiResponse(request, ticket);
  });

  // PATCH /api/v1/tickets/:id — update ticket
  app.patch('/:id', {
    preHandler: [requireRole('admin', 'manager', 'agent')],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const data = updateTicketSchema.parse(request.body);
      const ticket = await updateTicket(app.db, request.orgId, id, request.userId, data, request.ip);

      app.eventBus.emit('ticket.updated', {
        orgId: request.orgId,
        entityType: 'ticket',
        entityId: id,
        actorId: request.userId,
        data: ticket as unknown as Record<string, unknown>,
        timestamp: new Date(),
      });

      return apiResponse(request, ticket);
    },
  });

  // POST /api/v1/tickets/:id/status — change status
  app.post('/:id/status', {
    preHandler: [requireRole('admin', 'manager', 'agent')],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { status, reason } = changeStatusSchema.parse(request.body);
      const ticket = await changeTicketStatus(
        app.db, request.orgId, id, request.userId, status, reason, request.ip,
      );

      app.eventBus.emit('ticket.status_changed', {
        orgId: request.orgId,
        entityType: 'ticket',
        entityId: id,
        actorId: request.userId,
        data: { status },
        timestamp: new Date(),
      });

      return apiResponse(request, ticket);
    },
  });

  // POST /api/v1/tickets/:id/assign — assign/reassign
  app.post('/:id/assign', {
    preHandler: [requireRole('admin', 'manager')],
    handler: async (request) => {
      const { id } = request.params as { id: string };
      const { assigneeId, reason } = assignTicketSchema.parse(request.body);
      const ticket = await assignTicket(
        app.db, request.orgId, id, request.userId, assigneeId, reason, request.ip,
      );

      const event = assigneeId ? 'ticket.assigned' : 'ticket.assigned';
      app.eventBus.emit(event, {
        orgId: request.orgId,
        entityType: 'ticket',
        entityId: id,
        actorId: request.userId,
        data: { assigneeId },
        timestamp: new Date(),
      });

      return apiResponse(request, ticket);
    },
  });

  // GET /api/v1/tickets/:id/history — status history
  app.get('/:id/history', async (request) => {
    const { id } = request.params as { id: string };
    const history = await getTicketHistory(app.db, request.orgId, id);
    return apiResponse(request, history);
  });
}
