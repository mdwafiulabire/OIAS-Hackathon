/**
 * AI Triage plugin — Reasoning Agents track.
 *
 * Listens for `ticket.created`, calls Azure AI Foundry agent with the
 * ticket payload, persists the structured suggestion into ai_suggestions
 * with status='pending' for human review.
 *
 * Hard rules (from CLAUDE.md):
 *  - Plugin must check plugin_registry for the org before doing work.
 *  - AI failures must never surface to the user — graceful degradation.
 *  - No auto-apply. Suggestions stay pending until a human acts.
 */

import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  aiSuggestions,
  categories as categoriesTable,
  pluginRegistry,
  tickets as ticketsTable,
} from '@oias/db';
import type { OIASPlugin } from '@oias/types';
import { requireRole } from '../../core/modules/auth/rbac.js';
import { authMiddleware } from '../../core/modules/auth/auth.middleware.js';
import { apiResponse } from '../../shared/response.js';
import { auditLog } from '../../core/modules/audit/audit.service.js';
import { runAgent, FoundryError, foundryPing } from '../../core/ai/foundry-client.js';

const PLUGIN_KEY = 'ai_triage';

let appRef: FastifyInstance | null = null;

async function isEnabledForOrg(app: FastifyInstance, orgId: string): Promise<boolean> {
  const [row] = await app.db
    .select({ enabled: pluginRegistry.isEnabled })
    .from(pluginRegistry)
    .where(and(eq(pluginRegistry.orgId, orgId), eq(pluginRegistry.pluginKey, PLUGIN_KEY)));
  return Boolean(row?.enabled);
}

async function loadCategoryNames(app: FastifyInstance, orgId: string): Promise<string[]> {
  const rows = await app.db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(and(eq(categoriesTable.orgId, orgId), eq(categoriesTable.isActive, true)));
  return rows.map((r) => r.name);
}

async function loadTicket(app: FastifyInstance, orgId: string, ticketId: string) {
  const [row] = await app.db
    .select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      description: ticketsTable.description,
      priority: ticketsTable.priority,
      type: ticketsTable.type,
      refNumber: ticketsTable.refNumber,
    })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.id, ticketId), eq(ticketsTable.orgId, orgId)));
  return row ?? null;
}

const plugin: OIASPlugin = {
  key: PLUGIN_KEY,
  name: 'AI Triage (Azure Foundry)',
  version: '0.1.0',

  routes: (app: FastifyInstance) => {
    app.addHook('onRequest', authMiddleware);

    // GET /api/v1/plugins/ai_triage/health — proves Foundry connectivity for the demo.
    app.get('/health', async (request) => {
      const result = await foundryPing();
      return apiResponse(request, result);
    });

    // GET /api/v1/plugins/ai_triage/ticket/:ticketId — most recent suggestion for a ticket.
    app.get('/ticket/:ticketId', async (request) => {
      const { ticketId } = request.params as { ticketId: string };
      const rows = await app.db
        .select()
        .from(aiSuggestions)
        .where(and(eq(aiSuggestions.ticketId, ticketId), eq(aiSuggestions.orgId, request.orgId)));
      return apiResponse(request, rows);
    });

    // POST /api/v1/plugins/ai_triage/:id/accept — mark suggestion accepted.
    app.post('/:id/accept', {
      preHandler: [requireRole('admin', 'manager', 'agent')],
      handler: async (request) => {
        const { id } = request.params as { id: string };
        const [updated] = await app.db
          .update(aiSuggestions)
          .set({ status: 'accepted', reviewedBy: request.userId, reviewedAt: new Date() })
          .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.orgId, request.orgId)))
          .returning();
        if (updated) {
          await auditLog(app.db, {
            orgId: request.orgId,
            actorId: request.userId,
            action: 'ai.suggestion_accepted',
            entityType: 'ai_suggestion',
            entityId: id,
            payload: { suggestionType: updated.suggestionType },
            ipAddress: request.ip,
          });
          app.eventBus.emit('ai.suggestion_accepted', {
            orgId: request.orgId,
            entityType: 'ai_suggestion',
            entityId: id,
            actorId: request.userId,
            timestamp: new Date(),
          });
        }
        return apiResponse(request, updated ?? null);
      },
    });

    // POST /api/v1/plugins/ai_triage/:id/dismiss — mark suggestion dismissed.
    app.post('/:id/dismiss', {
      preHandler: [requireRole('admin', 'manager', 'agent')],
      handler: async (request) => {
        const { id } = request.params as { id: string };
        const [updated] = await app.db
          .update(aiSuggestions)
          .set({ status: 'dismissed', reviewedBy: request.userId, reviewedAt: new Date() })
          .where(and(eq(aiSuggestions.id, id), eq(aiSuggestions.orgId, request.orgId)))
          .returning();
        if (updated) {
          await auditLog(app.db, {
            orgId: request.orgId,
            actorId: request.userId,
            action: 'ai.suggestion_dismissed',
            entityType: 'ai_suggestion',
            entityId: id,
            payload: { suggestionType: updated.suggestionType },
            ipAddress: request.ip,
          });
          app.eventBus.emit('ai.suggestion_dismissed', {
            orgId: request.orgId,
            entityType: 'ai_suggestion',
            entityId: id,
            actorId: request.userId,
            timestamp: new Date(),
          });
        }
        return apiResponse(request, updated ?? null);
      },
    });
  },

  eventHandlers: {
    'ticket.created': async (payload) => {
      const app = appRef;
      if (!app) return;
      const { orgId, entityId: ticketId, actorId } = payload;

      if (!(await isEnabledForOrg(app, orgId))) {
        app.log.debug({ orgId }, 'ai_triage disabled for org — skipping');
        return;
      }

      const ticket = await loadTicket(app, orgId, ticketId);
      if (!ticket) {
        app.log.warn({ ticketId, orgId }, 'ai_triage: ticket not found');
        return;
      }

      const categoryNames = await loadCategoryNames(app, orgId);

      const userMessage = JSON.stringify({
        title: ticket.title,
        description: ticket.description ?? '',
        categories: categoryNames,
      });

      try {
        const result = await runAgent({ userMessage });
        const suggestionPayload =
          result.parsedJson ??
          // reason: agent ignored JSON contract — store raw text so a human can still read
          { _raw: result.rawText };

        const [row] = await app.db
          .insert(aiSuggestions)
          .values({
            orgId,
            ticketId,
            suggestionType: 'triage',
            payload: suggestionPayload as Record<string, unknown>,
            modelVersion: result.modelUsed ?? 'foundry-agent',
            status: 'pending',
          })
          .returning();

        if (row) {
          await auditLog(app.db, {
            orgId,
            actorId,
            action: 'ai.suggestion_created',
            entityType: 'ai_suggestion',
            entityId: row.id,
            payload: {
              ticketId,
              suggestionType: 'triage',
              durationMs: result.durationMs,
              totalTokens: result.usage?.totalTokens ?? null,
              threadId: result.threadId,
              runId: result.runId,
            },
          });

          app.eventBus.emit('ai.suggestion_created', {
            orgId,
            entityType: 'ai_suggestion',
            entityId: row.id,
            actorId,
            data: { ticketId, suggestionType: 'triage' },
            timestamp: new Date(),
          });

          app.log.info(
            { ticketId, suggestionId: row.id, durationMs: result.durationMs },
            'ai_triage suggestion created',
          );
        }
      } catch (err) {
        if (err instanceof FoundryError) {
          app.log.error({ err: err.message, ticketId, orgId }, 'ai_triage Foundry error');
        } else {
          app.log.error({ err, ticketId, orgId }, 'ai_triage unexpected error');
        }
      }
    },
  },

  onEnable: async (orgId) => {
    appRef?.log.info({ orgId }, 'ai_triage enabled for org');
  },
  onDisable: async (orgId) => {
    appRef?.log.info({ orgId }, 'ai_triage disabled for org');
  },
};

/**
 * Plugin loader stashes a FastifyInstance reference via this hook so event
 * handlers (which run with only an EventPayload) can reach app.db / app.log.
 */
export function bindApp(app: FastifyInstance) {
  appRef = app;
}

export default plugin;
