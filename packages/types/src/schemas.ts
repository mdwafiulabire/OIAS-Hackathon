import { z } from 'zod';
import {
  USER_ROLES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  NOTIFICATION_CHANNELS,
} from './enums.js';

// ─── Common ──────────────────────────────────────────────

export const uuidSchema = z.string().uuid();
export const cursorPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Organisation ────────────────────────────────────────

export const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  plan: z.enum(['lite', 'advanced']).default('lite'),
  timezone: z.string().default('UTC'),
});

// ─── User ────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(USER_ROLES).default('agent'),
  password: z.string().min(8).max(128).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

// ─── Ticket ──────────────────────────────────────────────

export const createTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(TICKET_TYPES).default('request'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  categoryId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  customFields: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  reason: z.string().max(1000).optional(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  reason: z.string().max(1000).optional(),
});

export const ticketFilterSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  search: z.string().max(255).optional(),
});

// ─── Note ────────────────────────────────────────────────

export const createNoteSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().default(true),
});

// ─── Category ────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().default(0),
});

// ─── Notification ────────────────────────────────────────

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(NOTIFICATION_CHANNELS).default('in_app'),
  subject: z.string().max(255).optional(),
  body: z.string().min(1),
  relatedType: z.string().optional(),
  relatedId: z.string().uuid().optional(),
});

// ─── Type exports ────────────────────────────────────────

export type CreateOrg = z.infer<typeof createOrgSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type CreateTicket = z.infer<typeof createTicketSchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;
export type ChangeStatus = z.infer<typeof changeStatusSchema>;
export type AssignTicket = z.infer<typeof assignTicketSchema>;
export type TicketFilter = z.infer<typeof ticketFilterSchema>;
export type CreateNote = z.infer<typeof createNoteSchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type CreateNotification = z.infer<typeof createNotificationSchema>;
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
