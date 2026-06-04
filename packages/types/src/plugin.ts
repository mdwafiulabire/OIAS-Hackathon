import type { FastifyInstance } from 'fastify';

export type EventBusEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.assigned'
  | 'ticket.reassigned'
  | 'ticket.overdue'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'ticket.reopened'
  | 'note.created'
  | 'attachment.added'
  | 'ai.suggestion_created'
  | 'ai.suggestion_accepted'
  | 'ai.suggestion_dismissed'
  | 'user.created'
  | 'user.deactivated';

export interface EventPayload {
  orgId: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface BullMQJobDefinition {
  name: string;
  handler: (data: unknown) => Promise<void>;
  options?: {
    concurrency?: number;
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
  };
}

export type PluginConfig = Record<string, unknown>;

export interface OIASPlugin {
  key: string;
  name: string;
  version: string;
  routes?: (app: FastifyInstance) => void;
  jobs?: BullMQJobDefinition[];
  eventHandlers?: {
    [event in EventBusEvent]?: (payload: EventPayload) => Promise<void>;
  };
  onEnable?: (orgId: string, config: PluginConfig) => Promise<void>;
  onDisable?: (orgId: string) => Promise<void>;
}
