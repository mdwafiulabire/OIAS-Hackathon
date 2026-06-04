/**
 * Azure AI Foundry Agent Service — REST client.
 *
 * Why REST not SDK: fewer deps, transparent error surface, no SDK churn
 * during a 10-day hackathon window. Swap to @azure/ai-projects post-event
 * if/when it stabilises.
 *
 * Pattern: thread → message → run → poll → read assistant message.
 * Returns parsed JSON if the agent obeyed the prompt's JSON contract;
 * otherwise returns the raw text and lets the caller decide.
 */

import { env } from '../../env.js';

const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS = 60_000;

export interface FoundryRunResult {
  threadId: string;
  runId: string;
  status: 'completed' | 'failed' | 'expired' | 'cancelled' | 'requires_action';
  rawText: string;
  parsedJson: unknown | null;
  modelUsed: string | null;
  durationMs: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export class FoundryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FoundryError';
  }
}

function requireConfig() {
  if (!env.AZURE_AI_FOUNDRY_ENDPOINT || !env.AZURE_AI_FOUNDRY_API_KEY || !env.AZURE_AI_FOUNDRY_AGENT) {
    throw new FoundryError(
      'Foundry not configured. Set AZURE_AI_FOUNDRY_ENDPOINT, AZURE_AI_FOUNDRY_API_KEY, AZURE_AI_FOUNDRY_AGENT.',
    );
  }
  return {
    endpoint: env.AZURE_AI_FOUNDRY_ENDPOINT.replace(/\/+$/, ''),
    apiKey: env.AZURE_AI_FOUNDRY_API_KEY,
    agent: env.AZURE_AI_FOUNDRY_AGENT,
    apiVersion: env.AZURE_AI_FOUNDRY_API_VERSION,
  };
}

async function foundryFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  cfg = requireConfig(),
): Promise<T> {
  const url = `${cfg.endpoint}${path}${path.includes('?') ? '&' : '?'}api-version=${cfg.apiVersion}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FoundryError(`Foundry ${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

let resolvedAgentId: string | null = null;

/** If user supplied a display name, look up the agent's asst_ id once and cache. */
async function resolveAgentId(): Promise<string> {
  if (resolvedAgentId) return resolvedAgentId;
  const cfg = requireConfig();
  if (cfg.agent.startsWith('asst_')) {
    resolvedAgentId = cfg.agent;
    return resolvedAgentId;
  }
  const list = await foundryFetch<{ data: Array<{ id: string; name: string }> }>(
    '/assistants?limit=100',
  );
  const match = list.data.find((a) => a.name === cfg.agent);
  if (!match) {
    throw new FoundryError(
      `No Foundry agent named "${cfg.agent}". Found: ${list.data.map((a) => a.name).join(', ')}`,
    );
  }
  resolvedAgentId = match.id;
  return resolvedAgentId;
}

/**
 * Run a single user message against the configured agent and return the
 * first assistant reply. Optionally seeded with a system override via
 * additional_instructions (overlay on the agent's saved instructions).
 */
export async function runAgent(input: {
  userMessage: string;
  additionalInstructions?: string;
}): Promise<FoundryRunResult> {
  const started = Date.now();
  const agentId = await resolveAgentId();

  // 1. Create thread
  const thread = await foundryFetch<{ id: string }>('/threads', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  // 2. Post user message
  await foundryFetch(`/threads/${thread.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'user',
      content: input.userMessage,
    }),
  });

  // 3. Create run
  const runBody: Record<string, unknown> = { assistant_id: agentId };
  if (input.additionalInstructions) {
    runBody.additional_instructions = input.additionalInstructions;
  }
  const run = await foundryFetch<{ id: string; status: string }>(
    `/threads/${thread.id}/runs`,
    { method: 'POST', body: JSON.stringify(runBody) },
  );

  // 4. Poll
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let runState: { id: string; status: string; model?: string; usage?: Record<string, number>; last_error?: { message?: string } } =
    run as never;
  while (Date.now() < deadline) {
    runState = await foundryFetch(`/threads/${thread.id}/runs/${run.id}`);
    if (
      runState.status === 'completed' ||
      runState.status === 'failed' ||
      runState.status === 'cancelled' ||
      runState.status === 'expired' ||
      runState.status === 'requires_action'
    ) {
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (runState.status !== 'completed') {
    throw new FoundryError(
      `Foundry run ended in status ${runState.status}: ${runState.last_error?.message ?? '(no detail)'}`,
    );
  }

  // 5. Fetch last assistant message
  type MsgList = {
    data: Array<{
      role: string;
      content: Array<{ type: string; text?: { value: string } }>;
    }>;
  };
  const msgs = await foundryFetch<MsgList>(
    `/threads/${thread.id}/messages?order=desc&limit=5`,
  );
  const assistantMsg = msgs.data.find((m) => m.role === 'assistant');
  const rawText =
    assistantMsg?.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text?.value ?? '')
      .join('\n') ?? '';

  return {
    threadId: thread.id,
    runId: run.id,
    status: 'completed',
    rawText,
    parsedJson: tryParseJson(rawText),
    modelUsed: runState.model ?? null,
    durationMs: Date.now() - started,
    usage: {
      promptTokens: runState.usage?.prompt_tokens,
      completionTokens: runState.usage?.completion_tokens,
      totalTokens: runState.usage?.total_tokens,
    },
  };
}

/**
 * Agents often wrap JSON in markdown code fences. Strip those before parse.
 */
function tryParseJson(text: string): unknown | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/** Health check — used by /health/foundry route. */
export async function foundryPing(): Promise<{ ok: boolean; agentId?: string; error?: string }> {
  try {
    const agentId = await resolveAgentId();
    return { ok: true, agentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
