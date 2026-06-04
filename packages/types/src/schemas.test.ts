import { describe, it, expect } from 'vitest';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  assignTicketSchema,
  createUserSchema,
  createCategorySchema,
  createNoteSchema,
  cursorPaginationSchema,
  createOrgSchema,
  ticketFilterSchema,
} from './schemas.js';

describe('createTicketSchema', () => {
  it('accepts valid ticket', () => {
    const result = createTicketSchema.safeParse({
      title: 'Bug in login page',
      description: 'Users see 500 error',
      type: 'incident',
      priority: 'urgent',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Bug in login page');
      expect(result.data.type).toBe('incident');
    }
  });

  it('applies defaults for optional fields', () => {
    const result = createTicketSchema.parse({ title: 'Minimal ticket' });
    expect(result.type).toBe('request');
    expect(result.priority).toBe('medium');
    expect(result.customFields).toEqual({});
  });

  it('rejects empty title', () => {
    const result = createTicketSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const result = createTicketSchema.safeParse({
      title: 'Test',
      priority: 'super_urgent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = createTicketSchema.safeParse({
      title: 'Test',
      type: 'unknown_type',
    });
    expect(result.success).toBe(false);
  });
});

describe('changeStatusSchema', () => {
  it('accepts valid status', () => {
    const result = changeStatusSchema.safeParse({ status: 'in_progress' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = changeStatusSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('accepts optional reason', () => {
    const result = changeStatusSchema.parse({
      status: 'resolved',
      reason: 'Fixed the bug',
    });
    expect(result.reason).toBe('Fixed the bug');
  });
});

describe('assignTicketSchema', () => {
  it('accepts valid UUID assignee', () => {
    const result = assignTicketSchema.safeParse({
      assigneeId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null assignee (unassign)', () => {
    const result = assignTicketSchema.safeParse({ assigneeId: null });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID string', () => {
    const result = assignTicketSchema.safeParse({ assigneeId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('accepts valid user', () => {
    const result = createUserSchema.parse({
      email: 'alice@acme.com',
      fullName: 'Alice Admin',
      role: 'admin',
    });
    expect(result.email).toBe('alice@acme.com');
    expect(result.role).toBe('admin');
  });

  it('defaults role to agent', () => {
    const result = createUserSchema.parse({
      email: 'bob@acme.com',
      fullName: 'Bob Agent',
    });
    expect(result.role).toBe('agent');
  });

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      fullName: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      email: 'test@test.com',
      fullName: 'Test',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });
});

describe('createCategorySchema', () => {
  it('accepts valid category', () => {
    const result = createCategorySchema.parse({ name: 'Sales' });
    expect(result.name).toBe('Sales');
    expect(result.sortOrder).toBe(0);
  });

  it('validates hex color format', () => {
    expect(createCategorySchema.safeParse({ name: 'IT', color: '#ff0000' }).success).toBe(true);
    expect(createCategorySchema.safeParse({ name: 'IT', color: 'red' }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'IT', color: '#fff' }).success).toBe(false);
  });
});

describe('createNoteSchema', () => {
  it('defaults isInternal to true', () => {
    const result = createNoteSchema.parse({ body: 'Internal note' });
    expect(result.isInternal).toBe(true);
  });

  it('rejects empty body', () => {
    expect(createNoteSchema.safeParse({ body: '' }).success).toBe(false);
  });
});

describe('cursorPaginationSchema', () => {
  it('applies default limit of 50', () => {
    const result = cursorPaginationSchema.parse({});
    expect(result.limit).toBe(50);
  });

  it('coerces string limit to number', () => {
    const result = cursorPaginationSchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('rejects limit over 100', () => {
    expect(cursorPaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects limit of 0', () => {
    expect(cursorPaginationSchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});

describe('createOrgSchema', () => {
  it('validates slug format', () => {
    expect(createOrgSchema.safeParse({ name: 'Acme', slug: 'acme-corp' }).success).toBe(true);
    expect(createOrgSchema.safeParse({ name: 'Acme', slug: 'Acme Corp' }).success).toBe(false);
    expect(createOrgSchema.safeParse({ name: 'Acme', slug: 'a' }).success).toBe(false);
  });

  it('defaults plan to lite', () => {
    const result = createOrgSchema.parse({ name: 'Acme', slug: 'acme' });
    expect(result.plan).toBe('lite');
  });
});

describe('ticketFilterSchema', () => {
  it('accepts empty filters', () => {
    const result = ticketFilterSchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts valid status filter', () => {
    const result = ticketFilterSchema.parse({ status: 'new' });
    expect(result.status).toBe('new');
  });

  it('rejects invalid status', () => {
    expect(ticketFilterSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });
});

describe('updateTicketSchema', () => {
  it('accepts partial updates', () => {
    const result = updateTicketSchema.parse({ title: 'Updated title' });
    expect(result.title).toBe('Updated title');
    expect(result.description).toBeUndefined();
  });

  it('accepts nullable categoryId', () => {
    const result = updateTicketSchema.parse({ categoryId: null });
    expect(result.categoryId).toBeNull();
  });
});
