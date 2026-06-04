import { and, eq } from 'drizzle-orm';
import type { Database } from '@oias/db';
import { categories } from '@oias/db';
import type { CreateCategory } from '@oias/types';
import { NotFoundError } from '@oias/types';

export async function createCategory(db: Database, orgId: string, data: CreateCategory) {
  const [category] = await db
    .insert(categories)
    .values({
      orgId,
      name: data.name,
      color: data.color,
      icon: data.icon,
      sortOrder: data.sortOrder,
    })
    .returning();

  return category!;
}

export async function listCategories(db: Database, orgId: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.orgId, orgId), eq(categories.isActive, true)))
    .orderBy(categories.sortOrder);
}

export async function getCategoryById(db: Database, orgId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.orgId, orgId)));

  if (!category) throw new NotFoundError('category', categoryId);
  return category;
}

export async function updateCategory(
  db: Database,
  orgId: string,
  categoryId: string,
  data: Partial<CreateCategory>,
) {
  await getCategoryById(db, orgId, categoryId);

  const [updated] = await db
    .update(categories)
    .set(data)
    .where(and(eq(categories.id, categoryId), eq(categories.orgId, orgId)))
    .returning();

  return updated!;
}

export async function deactivateCategory(db: Database, orgId: string, categoryId: string) {
  await getCategoryById(db, orgId, categoryId);

  await db
    .update(categories)
    .set({ isActive: false })
    .where(and(eq(categories.id, categoryId), eq(categories.orgId, orgId)));
}
