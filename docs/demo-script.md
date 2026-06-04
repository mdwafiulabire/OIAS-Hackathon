# OIAS Demo Video Script — Microsoft Agents League

**Track:** Reasoning Agents
**Duration target:** 4 min 30 s (under the 5-minute cap)
**Hosting:** YouTube (unlisted is allowed by the rules)
**Required:** Voice-over **and** screen capture must both be your own original work (rule §6).

---

## Cold open (0:00 – 0:20)

> *"OIAS — Operational Intelligence and Automation System — is a modular ops platform for SMEs. Today I'm wiring its AI triage plugin against the Microsoft Foundry Agent Service for the Reasoning Agents track of the Agents League hackathon."*

Show on screen: split — left half the OIAS dashboard at `localhost:3000`, right half `ai.azure.com` open to the agent overview page.

---

## Architecture in one slide (0:20 – 0:55)

Open `docs/architecture.md` rendered (VS Code preview).

> *"One Fastify API. One PostgreSQL database. One plugin called `ai-triage`. When a ticket is created, an in-process event fires, the plugin calls our Foundry agent over REST, and the agent returns a structured JSON suggestion that we store with `status = pending`. Nothing auto-applies. A human still drives."*

Highlight on the Mermaid diagram: **ticket.created** event → plugin → Foundry agent → ai_suggestions.

---

## Tour the Foundry agent (0:55 – 1:35)

Switch to `ai.azure.com`.

1. Click into project **OIAS-Hackthon** (Sweden Central).
2. Open **Models + endpoints** — show `gpt-4o-mini` deployment.
3. Open **Agents** → click **OIAS-AgentX**.
4. Show the **Instructions** panel — point out the JSON contract from `prompts/triage.md`.
5. Show **Tools** → **File search ON**. Mention: this is the Foundry IQ grounding layer; ticket history can be uploaded as a knowledge source.

> *"Multi-step reasoning lives here: retrieve, classify, score, summarise, justify, confidence, emit. The agent owns the chain, the API owns the persistence."*

---

## Happy path — create a ticket, watch the agent reply (1:35 – 2:50)

Switch to terminal + browser.

1. In one terminal: `pnpm dev` — show both `api` and `web` come up.
2. In a second terminal:
   ```bash
   curl http://localhost:3001/api/v1/plugins/ai_triage/health
   ```
   Show response `{ ok: true, agentId: "asst_..." }`. **Proves Foundry reachability.**
3. Open `localhost:3000`, log in as `admin@acme.test` / `password123`.
4. Click **New ticket**:
   - Title: `Production checkout broken — orders failing on payment`
   - Description: `Customers report 502 from /api/checkout. Started ~15 min ago.`
   - Priority: leave on `medium` (deliberately wrong — we want the agent to escalate)
   - Submit.
5. Switch to the API terminal: show the log line
   ```
   ai_triage suggestion created { ticketId: '...', durationMs: ~3500 }
   ```
6. Open the ticket detail page. The AI Suggestion panel shows:
   - `suggestedCategory: "Bug Report"` (or `null`)
   - `suggestedPriority: "urgent"` ← agent overruled the human's `medium`
   - `summary: "..."` (≤100 words)
   - `confidence: 0.86`
   - `reasoning: "..."`
7. Click **Accept** on `priority: urgent`. Ticket priority flips to urgent. Audit log shows two new entries: `ai.suggestion_created`, `ai.suggestion_accepted`.

---

## Reliability story (2:50 – 3:35)

> *"Three things make this safe for a real ops team."*

1. **Human-in-loop is structural, not optional.** Open `packages/db/src/schema/ai-suggestions.ts` — show `status: 'pending'` default.
2. **AI failures never break the core.** Stop the API. In `.env`, blank `AZURE_AI_FOUNDRY_API_KEY`. Restart. Create a new ticket. Show:
   - Ticket still gets created.
   - API log shows `ai_triage Foundry error: ... 401`.
   - No `ai_suggestions` row written — no half-applied state.
3. **Full traceability.** Open Drizzle Studio → `audit_logs`. Show the `ai.suggestion_created` row's payload field — contains the Foundry `threadId` and `runId`. You can pull up the exact run in `ai.azure.com` to inspect tokens, prompt, and tool calls.

---

## Multi-tenant safety (3:35 – 4:05)

Switch to `psql` (or Drizzle Studio).

```sql
SELECT plugin_key, is_enabled FROM plugin_registry WHERE org_id = '...';
```

> *"The agent only runs for orgs that opt in. `ai_triage` is one row in `plugin_registry`. Disable it, the listener silently no-ops. The same plugin can run for a hundred orgs without leakage — every query is scoped to the `orgId` carried on the event payload."*

---

## What's next (4:05 – 4:25)

> *"Three prompts are already in the `/prompts` folder — reply-draft, summary, manager-brief. Each becomes a Foundry agent. The plumbing built today — client, plugin shape, audit pattern — is reused verbatim. Foundry IQ knowledge sources will be populated from resolved ticket history nightly so suggestions get sharper the longer the platform runs."*

---

## Close (4:25 – 4:30)

Show repo URL + Discord handle.

> *"Repo at github.com/mdwafiulabire/OIAS-Hackathon. Built for the Microsoft Agents League — Reasoning Agents track. Thanks for watching."*

---

## Pre-record checklist

- [ ] `.env` has real `AZURE_AI_FOUNDRY_*` values
- [ ] `pnpm db:seed` run at least once (plugin_registry row exists)
- [ ] Foundry agent `OIAS-AgentX` actually responds — verify with `/health` route first
- [ ] Recording resolution: 1920×1080, font size ≥ 14pt in terminals
- [ ] Audio levelled, no background noise
- [ ] Video uploaded as **Unlisted** to YouTube; URL pasted into the submission form
- [ ] Optional: thumbnail showing the architecture diagram
