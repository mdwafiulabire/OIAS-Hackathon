import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@oias/types';
import { ForbiddenError } from '@oias/types';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1,
};

/**
 * Middleware factory: requires the user to have at least the specified role level.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.userRole || !allowedRoles.includes(request.userRole)) {
      throw new ForbiddenError(
        `Role '${request.userRole}' is not allowed. Required: ${allowedRoles.join(', ')}`,
      );
    }
  };
}

/**
 * Middleware: requires at least manager level.
 */
export function requireManager() {
  return requireRole('admin', 'manager');
}

/**
 * Middleware: requires admin.
 */
export function requireAdmin() {
  return requireRole('admin');
}

/**
 * Check if a role is at least as high as the target role.
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}
