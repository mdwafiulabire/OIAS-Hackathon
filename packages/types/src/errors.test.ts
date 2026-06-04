import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  InvalidTransitionError,
  PluginDisabledError,
} from './errors.js';

describe('AppError', () => {
  it('has correct properties', () => {
    const err = new AppError('TEST_ERROR', 'Something broke', 500);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Something broke');
    expect(err.status).toBe(500);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('NotFoundError', () => {
  it('formats message with entity type and id', () => {
    const err = new NotFoundError('ticket', '123');
    expect(err.status).toBe(404);
    expect(err.code).toBe('TICKET_NOT_FOUND');
    expect(err.message).toContain('ticket');
  });
});

describe('ForbiddenError', () => {
  it('returns 403', () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
  });
});

describe('UnauthorizedError', () => {
  it('returns 401', () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
  });
});

describe('ValidationError', () => {
  it('returns 400 with details', () => {
    const err = new ValidationError('Bad input', { field: 'email' });
    expect(err.status).toBe(400);
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('ConflictError', () => {
  it('returns 409', () => {
    const err = new ConflictError('Already exists');
    expect(err.status).toBe(409);
  });
});

describe('InvalidTransitionError', () => {
  it('includes from/to status in message', () => {
    const err = new InvalidTransitionError('new', 'closed');
    expect(err.message).toContain('new');
    expect(err.message).toContain('closed');
    expect(err.status).toBe(422);
  });
});

describe('PluginDisabledError', () => {
  it('includes plugin key', () => {
    const err = new PluginDisabledError('due_dates');
    expect(err.message).toContain('due_dates');
  });
});
