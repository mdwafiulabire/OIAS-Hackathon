import type { Database } from '@oias/db';
import { auditLogs } from '@oias/db';
import type { AuditAction } from '@oias/types';

interface AuditLogEntry {
  orgId: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Insert an audit log entry. Call within the same transaction as the change it records.
 */
export async function auditLog(db: Database, entry: AuditLogEntry) {
  await db.insert(auditLogs).values({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    payload: entry.payload ?? {},
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  });
}
