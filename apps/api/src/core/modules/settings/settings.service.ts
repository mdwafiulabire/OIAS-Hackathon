import { eq } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { organisations, pluginRegistry } from '@oias/db';
import { NotFoundError } from '@oias/types';

export async function getOrganisation(db: Database, orgId: string) {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId));

  if (!org) throw new NotFoundError('organisation', orgId);
  return org;
}

export async function updateOrganisation(
  db: Database,
  orgId: string,
  data: { name?: string; slug?: string; plan?: string; timezone?: string },
) {
  const [updated] = await db
    .update(organisations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organisations.id, orgId))
    .returning();

  if (!updated) throw new NotFoundError('organisation', orgId);
  return updated;
}

export async function listPlugins(db: Database, orgId: string) {
  return db
    .select()
    .from(pluginRegistry)
    .where(eq(pluginRegistry.orgId, orgId));
}

export async function togglePlugin(
  db: Database,
  orgId: string,
  pluginId: string,
  isEnabled: boolean,
  userId: string,
) {
  const [updated] = await db
    .update(pluginRegistry)
    .set({
      isEnabled,
      enabledAt: isEnabled ? new Date() : null,
      enabledBy: isEnabled ? userId : null,
      updatedAt: new Date(),
    })
    .where(eq(pluginRegistry.id, pluginId))
    .returning();

  if (!updated) throw new NotFoundError('plugin', pluginId);
  return updated;
}
