import type { FastifyInstance } from 'fastify';
import type { Database } from '@oias/db';
import type { OIASPlugin } from '@oias/types';
import { eq } from 'drizzle-orm';
import { pluginRegistry } from '@oias/db';

/** Map of plugin keys to their module paths */
const PLUGIN_MAP: Record<
  string,
  () => Promise<{ default: OIASPlugin; bindApp?: (app: FastifyInstance) => void }>
> = {
  due_dates: () => import('./plugins/due-dates/index.js'),
  ai_triage: () => import('./plugins/ai-triage/index.js'),
  // sla_policy: () => import('./plugins/sla-policy/index.js'),
  // email_intake: () => import('./plugins/email-intake/index.js'),
};

export async function loadPlugins(app: FastifyInstance, db: Database) {
  const enabledPlugins = await db
    .select()
    .from(pluginRegistry)
    .where(eq(pluginRegistry.isEnabled, true));

  for (const row of enabledPlugins) {
    const loader = PLUGIN_MAP[row.pluginKey];
    if (!loader) {
      app.log.warn(`Plugin "${row.pluginKey}" is enabled but no module found — skipping`);
      continue;
    }

    try {
      const mod = await loader();
      const plugin = mod.default;

      // Give plugins that need access to `app` from event handlers a chance to capture it.
      mod.bindApp?.(app);

      // Register routes
      if (plugin.routes) {
        await app.register(
          async (scoped) => {
            plugin.routes!(scoped);
          },
          { prefix: `/api/v1/plugins/${plugin.key}` },
        );
      }

      // Register event handlers
      if (plugin.eventHandlers) {
        const eventBus = app.eventBus;
        for (const [event, handler] of Object.entries(plugin.eventHandlers)) {
          if (handler) {
            eventBus.on(event as Parameters<typeof eventBus.on>[0], handler);
          }
        }
      }

      app.log.info(`Plugin "${plugin.key}" v${plugin.version} loaded`);
    } catch (err) {
      app.log.error(err, `Failed to load plugin "${row.pluginKey}"`);
    }
  }
}
