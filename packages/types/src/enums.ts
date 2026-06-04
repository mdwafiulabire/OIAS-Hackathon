export const USER_ROLES = ['admin', 'manager', 'agent', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TICKET_STATUSES = ['new', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_TYPES = ['request', 'lead', 'case', 'incident'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'webhook'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const AI_SUGGESTION_STATUSES = ['pending', 'accepted', 'edited', 'dismissed'] as const;
export type AiSuggestionStatus = (typeof AI_SUGGESTION_STATUSES)[number];

/** Allowed status transitions (default). Configurable per org in Advanced tier. */
export const DEFAULT_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'new', 'closed'],
  in_progress: ['resolved', 'assigned', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
} as const;
