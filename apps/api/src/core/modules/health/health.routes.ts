import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Database } from '@oias/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              db: { type: 'string' },
            },
            required: ['status', 'uptime', 'timestamp'],
          },
        },
      },
    },
    async (_req, reply) => {
      let dbStatus: 'ok' | 'error' = 'ok';

      try {
        // Lightweight liveness check — single round-trip
        await app.db.execute(sql`SELECT 1`);
      } catch {
        dbStatus = 'error';
      }

      return reply.send({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        db: dbStatus,
      });
    },
  );
}
