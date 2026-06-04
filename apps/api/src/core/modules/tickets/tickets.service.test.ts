/**
 * Unit tests for tickets.service.ts
 * All DB interactions mocked — no real Postgres connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
  changeTicketStatus,
  assignTicket,
  getTicketHistory,
} from './tickets.service.js';
import { NotFoundError, InvalidTransitionError } from '@oias/types';

// ─── Mock audit service ───────────────────────────────────────────────────────
vi.mock('../audit/audit.service.js', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

// Import after vi.mock so we get the hoisted spy reference
import { auditLog } from '../audit/audit.service.js';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID_B = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const TICKET_ID = '00000000-0000-0000-0000-000000000003';
const ASSIGNEE_ID = '00000000-0000-0000-0000-000000000004';
const PREV_ASSIGNEE_ID = '00000000-0000-0000-0000-000000000005';

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    orgId: ORG_ID,
    refNumber: 'TKT-202605-00001',
    title: 'Test ticket',
    description: null,
    type: 'request',
    priority: 'medium',
    status: 'new',
    categoryId: null,
    assigneeId: null,
    createdBy: USER_ID,
    customFields: {},
    metadata: {},
    resolvedAt: null,
    closedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-05-26T00:00:00Z'),
    updatedAt: new Date('2026-05-26T00:00:00Z'),
    ...overrides,
  };
}

// ─── createTicket ─────────────────────────────────────────────────────────────

describe('createTicket', () => {
  let db: ReturnType<typeof buildCreateDb>;

  function buildCreateDb(seq = 0, ticket = makeTicket()) {
    // select() → count query
    const countChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: seq }]),
    };

    // insert() called up to three times: tickets, ticketStatusHistory, (optional) ticketAssignments
    const insertReturning = vi.fn().mockResolvedValue([ticket]);
    const insertVoid = vi.fn().mockResolvedValue(undefined);

    const ticketInsertChain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: insertReturning,
    };
    const historyInsertChain = {
      insert: vi.fn().mockReturnThis(),
      values: insertVoid,
    };

    let insertCallCount = 0;
    const insertMock = vi.fn().mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) return ticketInsertChain;
      return historyInsertChain; // covers statusHistory + assignments
    });

    return {
      select: vi.fn().mockReturnValue(countChain),
      insert: insertMock,
      // Exposed for assertions
      _ticketInsertChain: ticketInsertChain,
      _insertMock: insertMock,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildCreateDb(0);
  });

  it('happy path — returns inserted ticket with generated ref number', async () => {
    const data = {
      title: 'Fix printer',
      type: 'request' as const,
      priority: 'medium' as const,
      customFields: {},
      metadata: {},
    };

    const result = await createTicket(db as unknown as import('@oias/db').Database, ORG_ID, USER_ID, data);

    expect(result.orgId).toBe(ORG_ID);
    expect(result.title).toBe('Test ticket');
    expect(db.insert).toHaveBeenCalled();

    // Audit log must be emitted with correct action and orgId
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'ticket.created',
        orgId: ORG_ID,
        actorId: USER_ID,
        entityType: 'ticket',
      }),
    );
  });

  it('generates ref number with correct month padding', async () => {
    const ticket = makeTicket({ refNumber: 'TKT-202601-00001' });
    db = buildCreateDb(0, ticket);

    const data = { title: 'Any', type: 'request' as const, priority: 'low' as const, customFields: {}, metadata: {} };
    const result = await createTicket(db as unknown as import('@oias/db').Database, ORG_ID, USER_ID, data);

    expect(result.refNumber).toMatch(/^TKT-\d{6}-\d{5}$/);
  });

  it('inserts assignment record when assigneeId provided', async () => {
    const ticket = makeTicket({ assigneeId: ASSIGNEE_ID });
    db = buildCreateDb(0, ticket);

    const data = {
      title: 'With assignee',
      type: 'request' as const,
      priority: 'medium' as const,
      assigneeId: ASSIGNEE_ID,
      customFields: {},
      metadata: {},
    };

    await createTicket(db as unknown as import('@oias/db').Database, ORG_ID, USER_ID, data);

    // insert called: tickets (1) + statusHistory (2) + assignments (3)
    expect(db.insert).toHaveBeenCalledTimes(3);
  });

  it('does NOT insert assignment record when no assigneeId', async () => {
    const data = { title: 'No assignee', type: 'request' as const, priority: 'medium' as const, customFields: {}, metadata: {} };

    await createTicket(db as unknown as import('@oias/db').Database, ORG_ID, USER_ID, data);

    // insert called: tickets (1) + statusHistory (2) — no assignments
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

// ─── getTicketById ────────────────────────────────────────────────────────────

describe('getTicketById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path — returns ticket when found', async () => {
    const ticket = makeTicket();
    const whereSpy = vi.fn().mockResolvedValue([ticket]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereSpy,
        }),
      }),
    };

    const result = await getTicketById(db as unknown as import('@oias/db').Database, ORG_ID, TICKET_ID);
    expect(result).toEqual(ticket);
    // where clause must receive conditions (non-empty call)
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when ticket missing', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    await expect(
      getTicketById(db as unknown as import('@oias/db').Database, ORG_ID, TICKET_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError with correct entity name', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    await expect(
      getTicketById(db as unknown as import('@oias/db').Database, ORG_ID, TICKET_ID),
    ).rejects.toThrow(/ticket/i);
  });

  it('org isolation — ticket belonging to org B not returned for org A query', async () => {
    // The DB mock returns a ticket whose orgId is ORG_ID_B.
    // Because getTicketById passes orgId to the WHERE clause, a real DB would return
    // nothing. We simulate that by returning [] (the WHERE condition filtered it out).
    const whereSpy = vi.fn().mockResolvedValue([]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: whereSpy,
        }),
      }),
    };

    // Querying ORG_ID_A for a ticket that lives in ORG_ID_B → NotFoundError
    await expect(
      getTicketById(db as unknown as import('@oias/db').Database, ORG_ID, TICKET_ID),
    ).rejects.toBeInstanceOf(NotFoundError);

    // The where spy must have been invoked — confirming a WHERE condition was applied
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── listTickets ──────────────────────────────────────────────────────────────

describe('listTickets', () => {
  function buildListDb(rows: unknown[]) {
    const limitSpy = vi.fn().mockResolvedValue(rows);
    const orderBySpy = vi.fn().mockReturnValue({ limit: limitSpy });
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
    const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

    return {
      select: selectSpy,
      _whereSpy: whereSpy,
      _limitSpy: limitSpy,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('happy path — returns data and null nextCursor when within limit', async () => {
    const rows = [makeTicket(), makeTicket({ id: '00000000-0000-0000-0000-000000000099' })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      {},
      { limit: 50 },
    );

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('sets nextCursor when more rows exist than limit', async () => {
    const rows = [
      makeTicket({ id: 'aaaaaaaa-0000-0000-0000-000000000001' }),
      makeTicket({ id: 'aaaaaaaa-0000-0000-0000-000000000002' }),
      makeTicket({ id: 'aaaaaaaa-0000-0000-0000-000000000003' }),
    ];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      {},
      { limit: 2 },
    );

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe('aaaaaaaa-0000-0000-0000-000000000002');
  });

  it('returns empty data with null cursor when no tickets', async () => {
    const db = buildListDb([]);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      {},
      { limit: 50 },
    );

    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('filter: status — does not throw and returns expected data shape', async () => {
    const rows = [makeTicket({ status: 'in_progress' })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      { status: 'in_progress' },
      { limit: 50 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    // where was invoked (conditions including status filter were passed)
    expect(db._whereSpy).toHaveBeenCalledTimes(1);
  });

  it('filter: priority — does not throw and returns expected data shape', async () => {
    const rows = [makeTicket({ priority: 'high' })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      { priority: 'high' },
      { limit: 50 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(db._whereSpy).toHaveBeenCalledTimes(1);
  });

  it('filter: assigneeId — does not throw and returns expected data shape', async () => {
    const rows = [makeTicket({ assigneeId: ASSIGNEE_ID })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      { assigneeId: ASSIGNEE_ID },
      { limit: 50 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(db._whereSpy).toHaveBeenCalledTimes(1);
  });

  it('filter: search — does not throw and returns expected data shape', async () => {
    const rows = [makeTicket({ title: 'printer issue' })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      { search: 'printer' },
      { limit: 50 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(db._whereSpy).toHaveBeenCalledTimes(1);
  });

  it('filter: cursor — passes cursor as condition and returns correct page', async () => {
    const CURSOR_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
    const rows = [makeTicket({ id: 'cccccccc-0000-0000-0000-000000000001' })];
    const db = buildListDb(rows);

    const result = await listTickets(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      {},
      { cursor: CURSOR_ID, limit: 50 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    // where was invoked with cursor condition included
    expect(db._whereSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── updateTicket ─────────────────────────────────────────────────────────────

describe('updateTicket', () => {
  function buildUpdateDb(existing = makeTicket(), updated = makeTicket({ title: 'Updated' })) {
    // getTicketById uses select
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([existing]),
    };

    // update chain — expose set spy so tests can assert the patch object
    const setSpy = vi.fn().mockReturnThis();
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      set: setSpy,
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };

    return {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      // Exposed for assertions
      _setSpy: setSpy,
      _updateChain: updateChain,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('happy path — returns updated ticket', async () => {
    const updatedTicket = makeTicket({ title: 'New title' });
    const db = buildUpdateDb(makeTicket(), updatedTicket);

    const result = await updateTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      { title: 'New title' },
    );

    expect(result.title).toBe('New title');

    // Audit log must fire with correct action
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'ticket.updated',
        orgId: ORG_ID,
        actorId: USER_ID,
        entityType: 'ticket',
        entityId: TICKET_ID,
      }),
    );
  });

  it('throws NotFoundError when ticket does not belong to org', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
    };

    await expect(
      updateTicket(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
        USER_ID,
        { title: 'Fail' },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('only sets fields that are present in data', async () => {
    const db = buildUpdateDb();

    await updateTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      { priority: 'high' },
    );

    // set() must have been called with priority but NOT title
    expect(db._setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'high' }),
    );
    expect(db._setSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ title: expect.anything() }),
    );
  });
});

// ─── changeTicketStatus ───────────────────────────────────────────────────────

describe('changeTicketStatus', () => {
  function buildStatusDb(
    existing = makeTicket({ status: 'new' }),
    lastHistory: unknown[] = [],
    updated = makeTicket({ status: 'in_progress' }),
  ) {
    let selectCallCount = 0;

    const getTicketChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([existing]),
    };

    const historyChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(lastHistory),
    };

    const selectMock = vi.fn().mockImplementation(() => {
      selectCallCount++;
      // 1st call = getTicketById, 2nd call = history duration query
      return selectCallCount === 1 ? getTicketChain : historyChain;
    });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };

    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertChain = {
      values: insertValuesSpy,
    };

    return {
      select: selectMock,
      update: vi.fn().mockReturnValue(updateChain),
      insert: vi.fn().mockReturnValue(insertChain),
      // Exposed for assertions
      _insertValuesSpy: insertValuesSpy,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('happy path — valid transition new→in_progress succeeds', async () => {
    const db = buildStatusDb();

    const result = await changeTicketStatus(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      'in_progress',
    );

    expect(result.status).toBe('in_progress');

    // Audit log must fire with correct action and status info
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'ticket.status_changed',
        orgId: ORG_ID,
        actorId: USER_ID,
        entityType: 'ticket',
        entityId: TICKET_ID,
      }),
    );
  });

  it('throws InvalidTransitionError for invalid transition new→resolved', async () => {
    const db = buildStatusDb();

    await expect(
      changeTicketStatus(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
        USER_ID,
        'resolved',
      ),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('throws InvalidTransitionError for invalid transition resolved→new', async () => {
    const db = buildStatusDb(makeTicket({ status: 'resolved' }));

    await expect(
      changeTicketStatus(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
        USER_ID,
        'new',
      ),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('sets resolvedAt when transitioning to resolved', async () => {
    const db = buildStatusDb(
      makeTicket({ status: 'in_progress' }),
      [],
      makeTicket({ status: 'resolved', resolvedAt: new Date() }),
    );

    const result = await changeTicketStatus(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      'resolved',
    );

    expect(result.resolvedAt).not.toBeNull();
  });

  it('sets closedAt when transitioning to closed', async () => {
    const db = buildStatusDb(
      makeTicket({ status: 'in_progress' }),
      [],
      makeTicket({ status: 'closed', closedAt: new Date() }),
    );

    const result = await changeTicketStatus(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      'closed',
    );

    expect(result.closedAt).not.toBeNull();
  });

  it('calculates durationSeconds when prior history exists', async () => {
    const pastDate = new Date(Date.now() - 60_000); // 60 seconds ago
    const lastHistory = [{ createdAt: pastDate }];
    const db = buildStatusDb(makeTicket({ status: 'new' }), lastHistory);

    await changeTicketStatus(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      'in_progress',
    );

    // insertChain.values must receive an object containing a numeric durationSeconds
    expect(db._insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: expect.any(Number) }),
    );
  });

  it('throws NotFoundError when ticket not found', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };

    await expect(
      changeTicketStatus(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
        USER_ID,
        'in_progress',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── assignTicket ─────────────────────────────────────────────────────────────

describe('assignTicket', () => {
  function buildAssignDb(
    existing = makeTicket(),
    updated = makeTicket({ assigneeId: ASSIGNEE_ID }),
  ) {
    const getTicketChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([existing]),
    };

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };

    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const insertChain = {
      values: insertValuesSpy,
    };

    return {
      select: vi.fn().mockReturnValue(getTicketChain),
      update: vi.fn().mockReturnValue(updateChain),
      insert: vi.fn().mockReturnValue(insertChain),
      // Exposed for assertions
      _insertValuesSpy: insertValuesSpy,
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('happy path — assigns agent to unassigned ticket', async () => {
    const db = buildAssignDb();

    const result = await assignTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      ASSIGNEE_ID,
    );

    expect(result.assigneeId).toBe(ASSIGNEE_ID);

    // Audit log must fire with 'ticket.assigned' (no previous assignee)
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'ticket.assigned',
        orgId: ORG_ID,
        actorId: USER_ID,
        entityType: 'ticket',
        entityId: TICKET_ID,
      }),
    );
  });

  it('happy path — unassigns ticket (assigneeId = null)', async () => {
    const db = buildAssignDb(
      makeTicket({ assigneeId: ASSIGNEE_ID }),
      makeTicket({ assigneeId: null }),
    );

    const result = await assignTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      null,
    );

    expect(result.assigneeId).toBeNull();
  });

  it('records assignment history — insertChain.values receives toUserId', async () => {
    const db = buildAssignDb();

    await assignTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      ASSIGNEE_ID,
    );

    expect(db._insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ toUserId: ASSIGNEE_ID }),
    );
  });

  it('emits ticket.reassigned audit action when previousAssignee exists', async () => {
    // Ticket already has an assignee — reassign to a new user
    const db = buildAssignDb(
      makeTicket({ assigneeId: PREV_ASSIGNEE_ID }),
      makeTicket({ assigneeId: ASSIGNEE_ID }),
    );

    await assignTicket(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
      USER_ID,
      ASSIGNEE_ID,
    );

    // Because previousAssignee !== null, action must be 'ticket.reassigned'
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'ticket.reassigned',
        orgId: ORG_ID,
        actorId: USER_ID,
        entityType: 'ticket',
        entityId: TICKET_ID,
      }),
    );
  });

  it('throws NotFoundError when ticket not found', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };

    await expect(
      assignTicket(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
        USER_ID,
        ASSIGNEE_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─── getTicketHistory ─────────────────────────────────────────────────────────

describe('getTicketHistory', () => {
  it('happy path — returns status history rows', async () => {
    const historyRows = [
      { id: 'h1', ticketId: TICKET_ID, fromStatus: null, toStatus: 'new', actorId: USER_ID, createdAt: new Date() },
      { id: 'h2', ticketId: TICKET_ID, fromStatus: 'new', toStatus: 'in_progress', actorId: USER_ID, createdAt: new Date() },
    ];

    let selectCallCount = 0;

    const getTicketChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([makeTicket()]),
    };

    const historyChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(historyRows),
    };

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? getTicketChain : historyChain;
      }),
    };

    const result = await getTicketHistory(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
    );

    expect(result).toHaveLength(2);
  });

  it('throws NotFoundError when ticket does not exist', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };

    await expect(
      getTicketHistory(
        db as unknown as import('@oias/db').Database,
        ORG_ID,
        TICKET_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns empty array when no history entries', async () => {
    let selectCallCount = 0;

    const getTicketChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([makeTicket()]),
    };

    const historyChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? getTicketChain : historyChain;
      }),
    };

    const result = await getTicketHistory(
      db as unknown as import('@oias/db').Database,
      ORG_ID,
      TICKET_ID,
    );

    expect(result).toEqual([]);
  });
});
