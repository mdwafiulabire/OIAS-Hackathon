import type { FastifyInstance } from 'fastify';
import { auth } from './auth.js';
import { toNodeHandler } from 'better-auth/node';
import { env } from '../../../env.js';

export async function authRoutes(app: FastifyInstance) {
  const handler = toNodeHandler(auth);

  // Prevent Fastify from consuming request body — Better Auth reads it raw
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_request, _payload, done) => {
    done(null, undefined);
  });

  app.all('/*', async (request, reply) => {
    // reply.hijack() bypasses Fastify CORS plugin, so set headers manually
    const origin = request.headers.origin;
    if (origin === env.APP_URL) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      reply.raw.statusCode = 204;
      reply.raw.end();
      return reply.hijack();
    }

    await handler(request.raw, reply.raw);
    reply.hijack();
  });
}
