export const AUDIT_ACTIONS = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.assigned',
  'ticket.reassigned',
  'ticket.closed',
  'note.created',
  'attachment.added',
  'user.created',
  'user.updated',
  'user.deactivated',
  'user.role_changed',
  'plugin.enabled',
  'plugin.disabled',
  'workflow.transition',
  'ai.suggestion_created',
  'ai.suggestion_accepted',
  'ai.suggestion_dismissed',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
