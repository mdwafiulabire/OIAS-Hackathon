import type { FastifyInstance } from 'fastify';
import type { Database } from '@oias/db';
import type { EventBus } from '../event-bus.js';
import type { UserRole } from '@oias/types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    eventBus: EventBus;
  }

  interface FastifyRequest {
    userId: string;
    orgId: string;
    userRole: UserRole;
  }
}
