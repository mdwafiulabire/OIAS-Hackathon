# OIAS Product Requirements Document
## Operational Intelligence and Automation System
**Version:** 1.0 | **Status:** Draft | **Date:** 2026-05-22

---

## 1. Overview

OIAS is a modular operations control platform built on a stable core (Lite) with optional plugin extensions. It solves the daily operational pain of untracked requests, missed deadlines, and manager blindspots — delivered fast, extended modularly.

### Product Tiers
| Tier | Description |
|------|-------------|
| **OIAS Lite** | Fixed core — fast to sell, fast to deploy |
| **OIAS Lite + Plugins** | Client selects 2–6 plugins from the menu |
| **OIAS Advanced** | Lite + most demanded plugins + enterprise controls |

### Design Principles
- Core stays stable. Plugins extend it, never break it.
- Plugins are toggled per client via feature flags.
- Every plugin implements one of: Trigger→Condition→Action, UI extension, or Integration handler.
- The system should feel like "we fixed your operations", not "we installed a tool".

---

## 2. Personas

| Persona | Role | Primary Goal |
|---------|------|--------------|
| **Staff / Agent** | Handles tickets day-to-day | See my queue, act fast, close tickets |
| **Team Manager** | Oversees team performance | Backlog visibility, flag overdue, brief daily |
| **Operations Admin** | Configures OIAS for the org | Set up workflows, users, plugins, SLAs |
| **Executive / Owner** | Monitors org health | Reports, trends, KPI scores |
| **System Integrator** | Connects OIAS to external tools | API/webhook access, stable contracts |

---

## 3. Module 1 — Users & Roles (RBAC)

### Purpose
Control who can see and do what across the system.

### User Stories

**US-1.1** As an Admin, I want to create user accounts with name, email, and role so that staff can log in and access their relevant views.

**US-1.2** As an Admin, I want to assign users to one of the system roles (Admin, Manager, Agent, Viewer) so that access is controlled without per-permission configuration.

**US-1.3** As an Admin, I want to deactivate a user account without deleting it so that historical records remain intact after staff changes.

**US-1.4** As a Manager, I want to see all users on my team with their current workload so I can make assignment decisions.

**US-1.5** As any User, I want to log in with my email and password (or SSO if enabled) so that I can securely access my workspace.

**US-1.6** As an Admin, I want role changes to take effect immediately without requiring a user to log out so that access adjustments are instant.

### Acceptance Criteria
- Four built-in roles: `admin`, `manager`, `agent`, `viewer`
- Role changes are atomic and reflected on next API call
- Deactivated users cannot log in but their ticket history is preserved
- All user actions are written to the audit log

---

## 4. Module 2 — Ticket System

### Purpose
Capture, track, and resolve operational requests, leads, or cases through a defined lifecycle.

### User Stories

**US-2.1** As a Staff Member, I want to create a ticket manually with a title, description, category, and priority so that a request is formally tracked.

**US-2.2** As a Manager, I want every ticket to have a unique reference number so that I can reference it in conversations without ambiguity.

**US-2.3** As a Staff Member, I want to add internal notes to a ticket that are not visible to external parties so that I can record context for my team.

**US-2.4** As a Manager, I want to see all tickets currently in the system with their status, assignee, and age so that I have full operational visibility.

**US-2.5** As an Agent, I want to search and filter tickets by status, assignee, category, and date range so that I can quickly find what I need.

**US-2.6** As an Admin, I want tickets to have configurable categories (e.g., Sales, Support, Operations) so that the system fits our business language.

**US-2.7** As any User, I want to attach files or images to a ticket so that supporting documents are kept with the work.

**US-2.8** As a Manager, I want to merge duplicate tickets so that we don't double-work the same issue.

### Acceptance Criteria
- Ticket statuses (core): `new`, `assigned`, `in_progress`, `resolved`, `closed`
- Every status change is timestamped and written to history
- Reference number format: `TKT-YYYYMM-NNNNN` (auto-generated)
- Internal notes are flagged `is_internal: true` and excluded from any external-facing views

---

## 5. Module 3 — Assignment & Ownership

### Purpose
Ensure every ticket has a clear owner and that ownership is traceable.

### User Stories

**US-3.1** As a Manager, I want to assign a ticket to a specific agent so that responsibility is clear.

**US-3.2** As a Manager, I want to reassign a ticket to a different agent and have the reason recorded so that we can audit handoffs.

**US-3.3** As an Agent, I want to see only my assigned tickets in my default queue view so that I'm not overwhelmed by the full backlog.

**US-3.4** As an Agent, I want to be notified (in-app) when a ticket is assigned to me so that nothing falls through the cracks.

**US-3.5** As a Manager, I want to see each agent's current ticket count so that I can make informed assignment decisions.

**US-3.6** As a Manager, I want to set a ticket as unassigned and have it visible in a shared backlog so that it isn't lost.

### Acceptance Criteria
- Tickets can have at most one primary assignee at a time
- Reassignment events record previous assignee, new assignee, actor, reason, and timestamp
- Notification delivery is async; failure does not block assignment action

---

## 6. Module 4 — Status Workflow & History

### Purpose
Move tickets through a defined lifecycle and preserve a complete, immutable history of every state change.

### User Stories

**US-4.1** As an Agent, I want to advance a ticket through the standard stages (New → Assigned → In Progress → Resolved → Closed) so that the current state is always visible.

**US-4.2** As a Manager, I want to reopen a Closed ticket back to In Progress so that re-opened issues are handled without creating duplicate tickets.

**US-4.3** As any User, I want to see the full history of a ticket (status changes, assignments, notes) in chronological order so that I can understand what happened and when.

**US-4.4** As an Admin, I want to prevent agents from skipping stages (e.g., jumping directly from New to Closed) so that workflow integrity is maintained.

**US-4.5** As a Manager, I want to see how long a ticket spent in each status so that I can identify bottlenecks in my process.

### Acceptance Criteria
- Status transitions are validated against an allowed-transitions map (configurable in Advanced)
- Every transition is recorded with: `from_status`, `to_status`, `actor_id`, `timestamp`, `reason` (optional)
- History is append-only; no history record can be deleted
- Time-in-status is derived from history timestamps, not stored redundantly

---

## 7. Module 5 — Basic Dashboard

### Purpose
Give managers an at-a-glance view of operational health without needing to run reports.

### User Stories

**US-5.1** As a Manager, I want to see total ticket counts by status (New, In Progress, Overdue, Resolved today) on a single screen so that I know the current health of operations.

**US-5.2** As a Manager, I want to see a backlog count per agent so that I can spot who is overwhelmed.

**US-5.3** As a Manager, I want overdue tickets highlighted with a red flag so that urgent items are impossible to miss.

**US-5.4** As a Manager, I want the dashboard to refresh automatically every few minutes so that I'm always looking at current data.

**US-5.5** As an Agent, I want a personal dashboard showing my queue sorted by urgency so that I know what to work on next.

### Acceptance Criteria
- Dashboard data reflects a maximum of 5-minute-old data (configurable polling or SSE)
- Overdue = ticket has passed its due date, if set, or has been in `in_progress` > 48h with no activity (configurable default)
- Widgets: Status Summary, Backlog by Agent, Overdue Tickets, Recent Activity Feed

---

## 8. Module 6 — Audit Trail

### Purpose
Maintain an immutable, searchable record of all system actions for accountability and compliance.

### User Stories

**US-6.1** As an Admin, I want every action in the system (ticket created, status changed, user role updated, note added) to be logged with the actor's identity and timestamp so that nothing can happen without a record.

**US-6.2** As an Admin, I want to search the audit log by user, action type, and date range so that I can investigate specific events.

**US-6.3** As an Admin, I want audit entries to be read-only and non-deletable so that they cannot be tampered with.

**US-6.4** As a Manager, I want to export the audit log for a date range as a CSV so that I can use it in external reviews.

### Acceptance Criteria
- Every write operation triggers an audit entry before the transaction commits
- Audit schema: `id`, `actor_id`, `action_type`, `entity_type`, `entity_id`, `payload_diff` (JSON), `ip_address`, `created_at`
- No `DELETE` or `UPDATE` operations are permitted on the `audit_logs` table
- Retention default: 90 days (extendable via Compliance Plugin)

---

## 9. Lite Signature Features

### 9.1 Manager Daily Summary (Digest)

**US-9.1** As a Manager, I want to receive a daily summary (via email or in-app) each morning showing: new tickets since yesterday, currently overdue tickets, and any bottlenecks (agents with >X open tickets) so that I start my day informed without logging in first.

**Acceptance Criteria**
- Digest generated at a configured time (default: 07:00 local)
- Contents: new ticket count, overdue count, top 3 bottleneck agents, recommended actions
- Delivery: in-app notification + optional email

### 9.2 Staff Smart Queue

**US-9.2** As an Agent, I want my ticket queue to be automatically sorted by a combination of urgency (priority + due date + age) so that I always work on the most important thing first without manual sorting.

**Acceptance Criteria**
- Sort score formula: `(priority_weight × 3) + (overdue_flag × 10) + (age_in_hours × 0.1)`
- Sort is computed at query time, not stored
- Agent can temporarily override sort but their default always returns to smart sort

### 9.3 AI Assist (Summary + Category + Reply Draft)

**US-9.3** As an Agent, I want AI to suggest a category and priority for each new ticket based on its content so that I spend less time triaging.

**US-9.4** As an Agent, I want AI to generate a draft reply for a ticket that I can review, edit, and approve before sending so that responses are faster without removing human judgment.

**US-9.5** As an Agent, I want AI to generate a one-paragraph summary of a long ticket thread so that I can get up to speed quickly when taking over from a colleague.

**Acceptance Criteria**
- All AI outputs are `suggestions only` — no AI action is applied without explicit human approval
- AI suggestions are shown inline in the ticket view with an "Accept / Edit / Dismiss" control
- Accepted suggestions are logged in audit trail as `actor: AI, approved_by: agent_id`
- AI calls are async; ticket loading is not blocked pending AI response

---

## 10. Advanced Tier Modules

### 10.1 Multi-Team Structures
Tickets, queues, dashboards, and reporting scoped to teams/departments. Agents belong to one or more teams. Managers have team-scoped or org-scoped views.

### 10.2 Configurable Workflow Engine
Admins define custom statuses and allowed transitions per team or ticket type. Transition rules can require approvals or trigger automations.

### 10.3 Approvals
Tickets requiring sign-off have an approval step inserted into the workflow. Approver is notified; ticket is blocked from advancing until approved or rejected.

### 10.4 SLA Timers & Escalation
Policies define response and resolution targets by priority and/or category. Breach events trigger escalation actions (reassign, notify manager, change priority). 

### 10.5 Performance Grading
Per-agent scorecards with configurable KPIs (resolution time, SLA compliance, ticket volume). Color grading (green/yellow/red) provides instant visual assessment.

### 10.6 Scheduled Reports & Analytics
Admins schedule weekly/monthly reports delivered as PDF or email. Analytics include backlog trends, response time trends, and category heatmaps.

---

## 11. Plugin Catalogue (Summary)

| Category | Plugin | Description |
|----------|--------|-------------|
| **Intake** | Email Intake | Emails auto-create tickets |
| | Web Form Intake | Form submissions create tickets |
| | WhatsApp Intake | WhatsApp messages create tickets |
| | Call Log Intake | Missed calls → auto ticket + follow-up |
| **Workflow** | Custom Workflow Builder | Custom stages per department |
| | Approvals Plugin | Manager sign-off before close/action |
| | Subtasks/Checklist | Break tickets into ordered steps |
| | Multi-Queue | Separate queues per team |
| **Deadline/SLA** | Due Dates | Due date field + reminders |
| | Overdue Escalation | Overdue → alert/auto-escalate |
| | SLA Policy | Response + resolution targets |
| | Breach Prediction | "Will breach in N hours" warning |
| **Assignment** | Round-Robin | Distribute tickets in rotation |
| | Load-Balancing | Assign to least-backlogged agent |
| | Skill-Based Routing | Match ticket tags to agent skills |
| | Work Hours & Capacity | Per-agent availability windows |
| | AI Staff Suggestion | AI recommends best assignee |
| **AI Assist** | Auto Category/Priority | AI triages incoming tickets |
| | Conversation Summary | Summarise long threads |
| | Reply Drafts | Human-approved reply suggestions |
| | Sentiment/Complaint Flag | Flag high-emotion tickets |
| | Next Best Action | Suggests next step for agent |
| | Manager AI Brief | Daily bottleneck + action summary |
| | Field Extraction | Auto-fill fields from message text |
| **Performance** | Performance Scorecard | KPI scoring per agent |
| | Color Grading | Green/yellow/red thresholds |
| | Quality Review Queue | Manager reviews sampled replies |
| | SLA Compliance Report | SLA met/missed breakdown |
| | Leaderboard | Optional gamification |
| **Reporting** | Scheduled Reports | Weekly/monthly PDF/email |
| | Trends Dashboard | Backlog + response time trends |
| | Category Heatmap | Issue type distribution |
| | Export Packs | CSV, Excel, API |
| **Integration** | CRM Sync | HubSpot/Zoho sync |
| | Calendar Scheduling | Link tickets to calendar events |
| | Accounting Links | Optional accounting system bridge |
| | Webhooks | ticket.created/updated/etc. events |
| | Automation Connector | Make / n8n / Zapier |
| **Security/Compliance** | SSO | SAML/OIDC single sign-on |
| | Access Review | Permission audit reports |
| | Data Retention | Configurable retention + purge |
| | Advanced Audit Log | Field-level change history |
| | Backups & Incident Log | Backup scheduling + incident records |

---

## 12. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Dashboard loads in < 2s for up to 10,000 tickets |
| **Scalability** | Core supports 500 concurrent users per tenant |
| **Availability** | 99.5% uptime SLA for hosted offering |
| **Security** | All data encrypted at rest (AES-256) and in transit (TLS 1.3) |
| **Audit** | Audit log immutable; no row-level delete permitted |
| **Multi-tenancy** | Full data isolation per organisation (`org_id` on all core tables) |
| **API** | REST API with OpenAPI 3.1 spec; all core actions available via API |
| **Plugins** | A plugin failure must not crash the core; plugins run in isolated handlers |

---

## 13. Out of Scope (v1)

- Native mobile app (mobile-responsive web is in scope)
- End-customer portal (external ticket submission via web form plugin only)
- Video calling or screen share within tickets
- AI model fine-tuning or custom AI model hosting
