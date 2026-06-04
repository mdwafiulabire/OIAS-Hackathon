import { describe, it, expect } from 'vitest';
import { hasMinRole } from './rbac.js';

describe('hasMinRole', () => {
  it('admin has all roles', () => {
    expect(hasMinRole('admin', 'admin')).toBe(true);
    expect(hasMinRole('admin', 'manager')).toBe(true);
    expect(hasMinRole('admin', 'agent')).toBe(true);
    expect(hasMinRole('admin', 'viewer')).toBe(true);
  });

  it('manager has manager and below', () => {
    expect(hasMinRole('manager', 'admin')).toBe(false);
    expect(hasMinRole('manager', 'manager')).toBe(true);
    expect(hasMinRole('manager', 'agent')).toBe(true);
    expect(hasMinRole('manager', 'viewer')).toBe(true);
  });

  it('agent has agent and viewer', () => {
    expect(hasMinRole('agent', 'admin')).toBe(false);
    expect(hasMinRole('agent', 'manager')).toBe(false);
    expect(hasMinRole('agent', 'agent')).toBe(true);
    expect(hasMinRole('agent', 'viewer')).toBe(true);
  });

  it('viewer only has viewer', () => {
    expect(hasMinRole('viewer', 'admin')).toBe(false);
    expect(hasMinRole('viewer', 'manager')).toBe(false);
    expect(hasMinRole('viewer', 'agent')).toBe(false);
    expect(hasMinRole('viewer', 'viewer')).toBe(true);
  });
});
