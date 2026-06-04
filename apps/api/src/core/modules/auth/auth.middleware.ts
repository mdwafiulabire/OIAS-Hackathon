import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import type { UserRole } from '@oias/types';
import { UnauthorizedError } from '@oias/types';
import { users as oiasUsers } from '@oias/db';

/**
 * Auth middleware — validates a Better Auth session and resolves the OIAS
 * org context for the request.
 *
 * Bridge: Better Auth's `user.id` is a nanoid (TEXT); OIAS `users.id` is a UUID.
 * The two are linked by `email` — every Better Auth signup creates an OIAS
 * users row with the same email (see auth.ts `databaseHooks.user.create.after`).
 */
export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  const { auth } = await import('./auth.js');
  const { fromNodeHeaders } = await import('better-auth/node');

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  const sessionEmail = session.user.email;
  if (!sessionEmail) {
    throw new UnauthorizedError('Session has no email');
  }

  const [oiasUser] = await request.server.db
    .select()
    .from(oiasUsers)
    .where(and(eq(oiasUsers.email, sessionEmail), isNull(oiasUsers.deletedAt)))
    .limit(1);

  if (!oiasUser) {
    throw new UnauthorizedError('No organisation profile for this user');
  }

  if (!oiasUser.isActive) {
    throw new UnauthorizedError('User account is deactivated');
  }

  request.userId = oiasUser.id;
  request.orgId = oiasUser.orgId;
  request.userRole = oiasUser.role as UserRole;
}
