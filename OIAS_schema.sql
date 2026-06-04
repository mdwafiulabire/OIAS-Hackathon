-- =============================================================
-- OIAS Core Database Schema (PostgreSQL)
-- Operational Intelligence and Automation System
-- Version: 1.0 | 2026-05-22
-- =============================================================
-- Design principles:
--   • org_id on every tenant-scoped table (row-level multi-tenancy)
--   • All PKs are UUIDs (uuid_generate_v4())
--   • Soft deletes where history matters (deleted_at TIMESTAMPTZ)
--   • Audit log is append-only; no DELETE/UPDATE permitted at DB level
--   • Plugin tables are prefixed plugin_<plugin_name>_
--   • Plugin tables always FK to core tables; never the reverse
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'agent', 'viewer');
CREATE TYPE ticket_status AS ENUM ('new', 'assigned', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_type AS ENUM ('request', 'lead', 'case', 'incident');
CREATE TYPE audit_action AS ENUM (
  'ticket.created', 'ticket.updated', 'ticket.status_changed',
  'ticket.assigned', 'ticket.reassigned', 'ticket.closed',
  'note.created', 'attachment.added',
  'user.created', 'user.updated', 'user.deactivated', 'user.role_changed',
  'plugin.enabled', 'plugin.disabled',
  'workflow.transition', 'ai.suggestion_accepted', 'ai.suggestion_dismissed'
);
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'webhook');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');


-- =============================================================
-- CORE TABLE 1: organisations
-- Root tenant record. Every other table scopes to org_id.
-- =============================================================

CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT NOT NULL UNIQUE,          -- URL-safe identifier e.g. "acme-corp"
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'lite',  -- 'lite' | 'advanced'
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  settings        JSONB NOT NULL DEFAULT '{}',   -- org-level config bag
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_organisations_slug ON organisations(slug) WHERE deleted_at IS NULL;


-- =============================================================
-- CORE TABLE 2: users
-- =============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'agent',
  avatar_url      TEXT,
  password_hash   TEXT,                          -- NULL if SSO-only
  last_login_at   TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB NOT NULL DEFAULT '{}',   -- personal preferences
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT uq_user_email_per_org UNIQUE (org_id, email)
);

CREATE INDEX idx_users_org ON users(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(org_id, role) WHERE is_active = TRUE;


-- =============================================================
-- CORE TABLE 3: teams  (used in Advanced; available in core for future)
-- =============================================================

CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  manager_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT uq_team_name_per_org UNIQUE (org_id, name)
);

CREATE TABLE team_members (
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);


-- =============================================================
-- CORE TABLE 4: categories
-- Configurable per org.
-- =============================================================

CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  color           TEXT,                          -- hex color for UI
  icon            TEXT,                          -- icon identifier
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_category_per_org UNIQUE (org_id, name)
);


-- =============================================================
-- CORE TABLE 5: tickets
-- Central entity. All plugin tables extend via ticket_id FK.
-- =============================================================

CREATE TABLE tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ref_number      TEXT NOT NULL,                 -- e.g. TKT-202605-00001 (generated by app)
  title           TEXT NOT NULL,
  description     TEXT,
  type            ticket_type NOT NULL DEFAULT 'request',
  status          ticket_status NOT NULL DEFAULT 'new',
  priority        ticket_priority NOT NULL DEFAULT 'medium',
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  custom_fields   JSONB NOT NULL DEFAULT '{}',   -- extensible without schema changes
  metadata        JSONB NOT NULL DEFAULT '{}',   -- source channel, external IDs, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT uq_ticket_ref_per_org UNIQUE (org_id, ref_number)
);

CREATE INDEX idx_tickets_org_status ON tickets(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_assignee ON tickets(org_id, assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tickets_created ON tickets(org_id, created_at DESC);
CREATE INDEX idx_tickets_updated ON tickets(org_id, updated_at DESC);
CREATE INDEX idx_tickets_category ON tickets(org_id, category_id);


-- =============================================================
-- CORE TABLE 6: ticket_status_history
-- Immutable log of every status transition.
-- =============================================================

CREATE TABLE ticket_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     ticket_status,                 -- NULL on creation
  to_status       ticket_status NOT NULL,
  actor_id        UUID NOT NULL REFERENCES users(id),
  reason          TEXT,
  duration_seconds INT,                          -- seconds spent in from_status
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tsh_ticket ON ticket_status_history(ticket_id, created_at);

-- Prevent UPDATE/DELETE on this table (application-level enforcement + policy below)
-- Postgres row security for extra safety:
ALTER TABLE ticket_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsh_insert_only ON ticket_status_history FOR INSERT WITH CHECK (TRUE);
-- No UPDATE or DELETE policies → those operations will be denied


-- =============================================================
-- CORE TABLE 7: ticket_assignments
-- Immutable log of every assignment change.
-- =============================================================

CREATE TABLE ticket_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by     UUID NOT NULL REFERENCES users(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ta_ticket ON ticket_assignments(ticket_id, created_at DESC);


-- =============================================================
-- CORE TABLE 8: notes
-- Internal notes + external messages on a ticket.
-- =============================================================

CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT TRUE,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ai_approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_notes_ticket ON notes(ticket_id, created_at) WHERE deleted_at IS NULL;


-- =============================================================
-- CORE TABLE 9: attachments
-- =============================================================

CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE CASCADE,
  note_id         UUID REFERENCES notes(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  file_name       TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  storage_key     TEXT NOT NULL,                 -- S3/GCS object key
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT att_parent_check CHECK (
    (ticket_id IS NOT NULL AND note_id IS NULL) OR
    (ticket_id IS NULL AND note_id IS NOT NULL)
  )
);


-- =============================================================
-- CORE TABLE 10: notifications
-- =============================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  subject         TEXT,
  body            TEXT NOT NULL,
  status          notification_status NOT NULL DEFAULT 'pending',
  related_type    TEXT,                          -- 'ticket', 'note', etc.
  related_id      UUID,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_status ON notifications(status) WHERE status = 'pending';


-- =============================================================
-- CORE TABLE 11: audit_logs
-- Append-only. Row security enforces insert-only.
-- =============================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          audit_action NOT NULL,
  entity_type     TEXT NOT NULL,                 -- 'ticket', 'user', etc.
  entity_id       UUID,
  payload         JSONB NOT NULL DEFAULT '{}',   -- { before: {}, after: {} }
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_time ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(org_id, actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Append-only enforcement
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_logs FOR INSERT WITH CHECK (TRUE);


-- =============================================================
-- CORE TABLE 12: ai_suggestions
-- Tracks all AI-generated suggestions and their outcomes.
-- =============================================================

CREATE TABLE ai_suggestions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,                 -- 'category', 'priority', 'reply_draft', 'summary'
  payload         JSONB NOT NULL,                -- the suggested content
  model_version   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'edited' | 'dismissed'
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_sug_ticket ON ai_suggestions(ticket_id, created_at DESC);


-- =============================================================
-- PLUGIN REGISTRY
-- Tracks which plugins are enabled per organisation.
-- =============================================================

CREATE TABLE plugin_registry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plugin_key      TEXT NOT NULL,                 -- e.g. 'due_dates', 'sla_policy', 'email_intake'
  is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  config          JSONB NOT NULL DEFAULT '{}',   -- plugin-specific configuration
  enabled_at      TIMESTAMPTZ,
  enabled_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_plugin_per_org UNIQUE (org_id, plugin_key)
);

CREATE INDEX idx_plugin_registry ON plugin_registry(org_id, is_enabled);

-- =============================================================
-- PLUGIN EXTENSION PATTERN
-- =============================================================
-- Each plugin adds its OWN tables. Rules:
--   1. Plugin table names: plugin_<key>_<entity>
--   2. Always FK to core table (tickets.id, users.id, etc.)
--   3. Core tables NEVER reference plugin tables
--   4. Plugin tables carry their own org_id for direct queries
--   5. Dropping a plugin = DROP its tables; core is unaffected
-- =============================================================

-- ---------------------------------------------------------------
-- PLUGIN: due_dates
-- ---------------------------------------------------------------
CREATE TABLE plugin_due_dates_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  due_at          TIMESTAMPTZ NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dd_org_due ON plugin_due_dates_entries(org_id, due_at)
  WHERE due_at > NOW();


-- ---------------------------------------------------------------
-- PLUGIN: sla_policy
-- ---------------------------------------------------------------
CREATE TABLE plugin_sla_policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  priority        ticket_priority NOT NULL,
  response_minutes INT NOT NULL,                 -- target first response
  resolution_minutes INT NOT NULL,              -- target full resolution
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plugin_sla_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  policy_id       UUID NOT NULL REFERENCES plugin_sla_policies(id),
  response_due_at TIMESTAMPTZ NOT NULL,
  resolution_due_at TIMESTAMPTZ NOT NULL,
  first_responded_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  response_breached BOOLEAN NOT NULL DEFAULT FALSE,
  resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sla_tickets_breach ON plugin_sla_tickets(org_id, resolution_due_at)
  WHERE resolved_at IS NULL;


-- ---------------------------------------------------------------
-- PLUGIN: performance_scorecard
-- ---------------------------------------------------------------
CREATE TABLE plugin_scorecard_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  tickets_resolved INT NOT NULL DEFAULT 0,
  avg_resolution_hours NUMERIC(8,2),
  sla_compliance_pct NUMERIC(5,2),
  quality_score   NUMERIC(5,2),
  grade           TEXT,                          -- 'green' | 'yellow' | 'red'
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_scorecard_user_period UNIQUE (user_id, period_start)
);


-- ---------------------------------------------------------------
-- PLUGIN: email_intake
-- ---------------------------------------------------------------
CREATE TABLE plugin_email_intake_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  message_id      TEXT NOT NULL UNIQUE,          -- email Message-ID header
  from_address    TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- PLUGIN: webhooks  (outbound event delivery)
-- ---------------------------------------------------------------
CREATE TABLE plugin_webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,                 -- HMAC signing key
  events          TEXT[] NOT NULL,               -- ['ticket.created', 'ticket.updated', ...]
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plugin_webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id     UUID NOT NULL REFERENCES plugin_webhook_endpoints(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  http_status     INT,
  response_body   TEXT,
  attempt_count   INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wh_delivery_pending ON plugin_webhook_deliveries(next_attempt_at)
  WHERE delivered_at IS NULL AND attempt_count < 5;


-- ---------------------------------------------------------------
-- PLUGIN: crm_sync
-- ---------------------------------------------------------------
CREATE TABLE plugin_crm_sync_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  crm_provider    TEXT NOT NULL,                 -- 'hubspot' | 'zoho' | etc.
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  crm_record_type TEXT NOT NULL,                 -- 'deal' | 'contact' | 'ticket'
  crm_record_id   TEXT NOT NULL,
  last_synced_at  TIMESTAMPTZ,
  sync_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_crm_ticket UNIQUE (ticket_id, crm_provider, crm_record_type)
);


-- ---------------------------------------------------------------
-- PLUGIN: subtasks
-- ---------------------------------------------------------------
CREATE TABLE plugin_subtasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subtasks_ticket ON plugin_subtasks(ticket_id, sort_order);


-- =============================================================
-- VIEWS (convenience queries)
-- =============================================================

-- Manager dashboard: overdue tickets
CREATE VIEW v_overdue_tickets AS
SELECT
  t.id,
  t.org_id,
  t.ref_number,
  t.title,
  t.status,
  t.priority,
  t.assignee_id,
  u.full_name AS assignee_name,
  t.updated_at,
  EXTRACT(EPOCH FROM (NOW() - t.updated_at)) / 3600 AS hours_stale
FROM tickets t
LEFT JOIN users u ON u.id = t.assignee_id
WHERE t.deleted_at IS NULL
  AND t.status NOT IN ('resolved', 'closed')
  AND t.updated_at < NOW() - INTERVAL '48 hours';

-- Agent smart queue score (used for queue sort)
-- score = (priority_weight * 3) + (overdue_flag * 10) + (age_hours * 0.1)
CREATE VIEW v_agent_queue AS
SELECT
  t.id,
  t.org_id,
  t.assignee_id,
  t.ref_number,
  t.title,
  t.status,
  t.priority,
  t.created_at,
  CASE t.priority
    WHEN 'urgent' THEN 4
    WHEN 'high'   THEN 3
    WHEN 'medium' THEN 2
    ELSE 1
  END AS priority_weight,
  CASE WHEN t.updated_at < NOW() - INTERVAL '48 hours' THEN 1 ELSE 0 END AS overdue_flag,
  EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 AS age_hours,
  (
    CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END * 3
    + CASE WHEN t.updated_at < NOW() - INTERVAL '48 hours' THEN 10 ELSE 0 END
    + EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600 * 0.1
  ) AS smart_sort_score
FROM tickets t
WHERE t.deleted_at IS NULL
  AND t.status NOT IN ('resolved', 'closed');

-- Backlog per agent
CREATE VIEW v_agent_backlog AS
SELECT
  t.org_id,
  t.assignee_id,
  u.full_name AS assignee_name,
  COUNT(*) AS open_tickets,
  COUNT(*) FILTER (WHERE t.priority IN ('high', 'urgent')) AS high_priority_count,
  COUNT(*) FILTER (WHERE t.updated_at < NOW() - INTERVAL '48 hours') AS overdue_count
FROM tickets t
JOIN users u ON u.id = t.assignee_id
WHERE t.deleted_at IS NULL
  AND t.status NOT IN ('resolved', 'closed')
  AND t.assignee_id IS NOT NULL
GROUP BY t.org_id, t.assignee_id, u.full_name;


-- =============================================================
-- FUNCTIONS
-- =============================================================

-- Auto-generate ticket ref numbers
CREATE OR REPLACE FUNCTION generate_ticket_ref(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_seq INT;
  v_prefix TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM tickets
  WHERE org_id = p_org_id;

  v_prefix := 'TKT-' || TO_CHAR(NOW(), 'YYYYMM') || '-';
  RETURN v_prefix || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to mutable core tables
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_organisations_updated BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================
-- SEED: Default status transitions (stored in org settings)
-- =============================================================
-- Default allowed transitions (enforced at application layer):
-- new        → [assigned, in_progress, closed]
-- assigned   → [in_progress, new, closed]
-- in_progress→ [resolved, assigned, closed]
-- resolved   → [closed, in_progress]  -- re-open path
-- closed     → [in_progress]          -- re-open path
-- Stored as organisations.settings->>'workflow_transitions' (JSON)
