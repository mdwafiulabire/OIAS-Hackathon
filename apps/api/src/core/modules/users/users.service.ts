import { and, eq, isNull, desc, lt } from 'drizzle-orm';
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Database } from '@oias/db';
import { users } from '@oias/db';
import type { CreateUser, UpdateUser, CursorPagination } from '@oias/types';
import { NotFoundError, ConflictError } from '@oias/types';
import { auditLog } from '../audit/audit.service.js';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function createUser(
  db: Database,
  orgId: string,
  actorId: string,
  data: CreateUser,
  ip?: string,
) {
  // Check for duplicate email within org
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.email, data.email), isNull(users.deletedAt)));

  if (existing) throw new ConflictError(`User with email '${data.email}' already exists in this organisation`);

  const passwordHash = data.password ? await hashPassword(data.password) : null;

  const [user] = await db
    .insert(users)
    .values({
      orgId,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      passwordHash,
    })
    .returning();

  await auditLog(db, {
    orgId,
    actorId,
    action: 'user.created',
    entityType: 'user',
    entityId: user!.id,
    payload: { email: data.email, role: data.role },
    ipAddress: ip,
  });

  return user!;
}

export async function getUserById(db: Database, orgId: string, userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), isNull(users.deletedAt)));

  if (!user) throw new NotFoundError('user', userId);
  return user;
}

export async function listUsers(db: Database, orgId: string, pagination: CursorPagination) {
  const conditions = [eq(users.orgId, orgId), isNull(users.deletedAt)];
  if (pagination.cursor) conditions.push(lt(users.id, pagination.cursor));

  const rows = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const data = hasMore ? rows.slice(0, pagination.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]!.id : null;

  return { data, nextCursor };
}

export async function updateUser(
  db: Database,
  orgId: string,
  targetUserId: string,
  actorId: string,
  data: UpdateUser,
  ip?: string,
) {
  const existing = await getUserById(db, orgId, targetUserId);

  const [updated] = await db
    .update(users)
    .set({
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.role && { role: data.role }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    })
    .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)))
    .returning();

  if (data.role && data.role !== existing.role) {
    await auditLog(db, {
      orgId,
      actorId,
      action: 'user.role_changed',
      entityType: 'user',
      entityId: targetUserId,
      payload: { before: { role: existing.role }, after: { role: data.role } },
      ipAddress: ip,
    });
  }

  if (data.isActive === false && existing.isActive) {
    await auditLog(db, {
      orgId,
      actorId,
      action: 'user.deactivated',
      entityType: 'user',
      entityId: targetUserId,
      ipAddress: ip,
    });
  }

  return updated!;
}

export async function deactivateUser(
  db: Database,
  orgId: string,
  targetUserId: string,
  actorId: string,
  ip?: string,
) {
  return updateUser(db, orgId, targetUserId, actorId, { isActive: false }, ip);
}
