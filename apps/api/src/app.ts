import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { env } from './env.js';
import { errorHandler } from './shared/error-handler.js';
import { createDb } from '@oias/db';
import { createEventBus } from './event-bus.js';
import { loadPlugins } from './plugin-loader.js';
import { ticketRoutes } from './core/modules/tickets/tickets.routes.js';
import { userRoutes } from './core/modules/users/users.routes.js';
import { noteRoutes } from './core/modules/notes/notes.routes.js';
import { categoryRoutes } from './core/modules/categories/categories.routes.js';
import { auditRoutes } from './core/modules/audit/audit.routes.js';
import { dashboardRoutes } from './core/modules/dashboard/dashboard.routes.js';
import { authRoutes } from './core/modules/auth/auth.routes.js';
import { settingsRoutes } from './core/modules/settings/settings.routes.js';
import { notificationRoutes } from './core/modules/notifications/notifications.routes.js';
import { healthRoutes } from './core/modules/health/health.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Plugins
  await app.register(cors, { origin: env.APP_URL, credentials: true });
  if (env.NODE_ENV === 'production') {
    await app.register(helmet);
  }
  await app.register(sensible);

  // Database
  const db = createDb(env.DATABASE_URL);
  app.decorate('db', db);

  // Event bus
  const eventBus = createEventBus();
  app.decorate('eventBus', eventBus);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Core routes
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(ticketRoutes, { prefix: '/api/v1/tickets' });
  await app.register(noteRoutes, { prefix: '/api/v1/tickets' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  // Load plugins
  await loadPlugins(app, db);

  return app;
}
