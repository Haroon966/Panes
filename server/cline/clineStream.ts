/**
 * Local Cline / OpenAI-compatible HTTP bridge.
 *
 * Resolution order for base URL (first non-empty wins):
 * 1) JSON body / query clineLocalBaseUrl — unless it is the old UI example :8787 and a server env or DB fallback exists
 * 2) SQLite app_prefs.cline_local_base_url
 * 3) CLINE_LOCAL_BASE_URL
 * 4) GROQ_OPENAI_BASE_URL — default https://api.groq.com/openai when set (OpenAI-compatible)
 * 5) OLLAMA_BASE_URL (OpenAI-compatible /v1 on Ollama)
 * 6) LMSTUDIO_BASE_URL
 *
 * Env:
 * - CLINE_LOCAL_BASE_URL — explicit bridge
 * - OLLAMA_BASE_URL / LMSTUDIO_BASE_URL — used when Cline URL not set (see .env.example)
 * - CLINE_DEFAULT_MODEL / OLLAMA_MODEL — model id when upstream is Ollama (UI model is often a cloud id)
 * - CLINE_CHAT_PATH — default /v1/chat/completions
 * - CLINE_STREAM_MODE — openai_sse (default) or text (raw UTF-8 stream)
 * - CLINE_AUTH_TOKEN — Authorization: Bearer to the gateway (server only)
 * - GROQ_API_KEY — used as Bearer when upstream host is api.groq.com (if CLINE_AUTH_TOKEN unset)
 * - GROQ_DEFAULT_MODEL — default model id for Groq when UI sends no Cline model (optional)
 * - CLINE_AGENT_IDS — comma-separated ids for GET /api/agent/cline/options
 * - CLINE_BODY_AGENT_FIELD — JSON field for agent id (default cline_agent_id)
 */

export type ClineChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type ClineProxyInput = {
  baseUrl: string;
  chatPath: string;
  streamMode: 'openai_sse' | 'text';
  model: string;
  messages: ClineChatMessage[];
  terminalContext?: string;
  errorContext?: string;
  workspaceRoot?: string;
  clineAgentId?: string;
  authToken?: string;
  signal?: AbortSignal;
};

export function getDefaultClineChatPath(): string {
  const p = process.env.CLINE_CHAT_PATH?.trim();
  return p && p.startsWith('/') ? p : '/v1/chat/completions';
}

export function getDefaultClineStreamMode(): 'openai_sse' | 'text' {
  return process.env.CLINE_STREAM_MODE === 'text' ? 'text' : 'openai_sse';
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

/** UI used to suggest :8787; ignore it when server can fall back to Ollama/LM Studio / CLINE env. */
function isStaleExampleClineUrl(raw: string): boolean {
  const s = normalizeBaseUrl(raw);
  return s === 'http://127.0.0.1:8787' || s === 'http://localhost:8787';
}

function envClineFallbackChain(): string {
  const groqBase = process.env.GROQ_OPENAI_BASE_URL?.trim();
  return (
    process.env.CLINE_LOCAL_BASE_URL?.trim() ||
    groqBase ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.LMSTUDIO_BASE_URL?.trim() ||
    ''
  );
}

/**
 * Resolution order (first non-empty after normalization):
 * 1) JSON/query body override
 * 2) DB `cline_local_base_url` (see app_prefs)
 * 3) Env chain (CLINE_LOCAL_BASE_URL, GROQ_OPENAI_BASE_URL, OLLAMA_BASE_URL, LMSTUDIO_BASE_URL)
 */
export function resolveClineBaseUrl(bodyBase?: string, dbBase?: string): string {
  const envFallback = envClineFallbackChain();
  const fromBodyRaw = bodyBase?.trim();
  let fromBody = fromBodyRaw || '';
  if (fromBodyRaw && isStaleExampleClineUrl(fromBodyRaw) && (envFallback || dbBase?.trim())) {
    fromBody = '';
  }
  let fromDb = dbBase?.trim() || '';
  if (fromDb && isStaleExampleClineUrl(fromDb) && envFallback) {
    fromDb = '';
  }
  return normalizeBaseUrl(fromBody || fromDb || envFallback);
}

/** True if env provides a Cline upstream chain (excluding DB; use resolveClineBaseUrl with DB for full picture). */
export function hasServerClineBaseUrlEnv(): boolean {
  return !!envClineFallbackChain();
}

function basesProbablySameOpenAiHost(a: string, b: string): boolean {
  try {
    const ua = new URL(a.startsWith('http') ? a : `http://${a}`);
    const ub = new URL(b.startsWith('http') ? b : `http://${b}`);
    const pa = ua.port || (ua.protocol === 'https:' ? '443' : '80');
    const pb = ub.port || (ub.protocol === 'https:' ? '443' : '80');
    const ha = ua.hostname;
    const hb = ub.hostname;
    const sameHost =
      ha === hb ||
      (ha === 'localhost' && hb === '127.0.0.1') ||
      (ha === '127.0.0.1' && hb === 'localhost');
    return sameHost && pa === pb;
  } catch {
    return normalizeBaseUrl(a) === normalizeBaseUrl(b);
  }
}

function openAiBasePort(b: string): string | null {
  try {
    const u = new URL(b.startsWith('http') ? b : `http://${b}`);
    return u.port || (u.protocol === 'https:' ? '443' : '80');
  } catch {
    return null;
  }
}

/** Ollama OpenAI shim is usually :11434 even when only CLINE_LOCAL_BASE_URL is set. */
function looksLikeOllamaOpenAiBase(b: string): boolean {
  return openAiBasePort(b) === '11434';
}

function looksLikeLmStudioOpenAiBase(b: string): boolean {
  return openAiBasePort(b) === '1234';
}

export function isGroqClineUpstream(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`);
    return u.hostname === 'api.groq.com';
  } catch {
    return false;
  }
}

/** Groq’s OpenAI API expects hyphenated ids (e.g. llama-3.3-70b-versatile), not Ollama-style llama3.2. */
function looksLikeGroqOpenAiModelId(id: string): boolean {
  const t = id.trim();
  return t.length > 0 && t.includes('-');
}

export function isOllamaClineUpstream(baseUrl: string): boolean {
  const b = normalizeBaseUrl(baseUrl);
  const ollama = process.env.OLLAMA_BASE_URL?.trim();
  return (
    (!!ollama && basesProbablySameOpenAiHost(b, normalizeBaseUrl(ollama))) || looksLikeOllamaOpenAiBase(b)
  );
}

/**
 * Use Ollama’s native tags API so Cline sends a model you actually pulled (OpenAI shim is picky about names).
 */
export async function pickOllamaModelFromTags(baseUrl: string): Promise<string | null> {
  try {
    const root = normalizeBaseUrl(baseUrl);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);
    const r = await fetch(`${root}/api/tags`, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as { models?: Array<{ name: string; modified_at?: string }> };
    const list = j.models ?? [];
    if (!list.length) return null;
    list.sort((a, b) => {
      const ta = a.modified_at ? Date.parse(a.modified_at) : 0;
      const tb = b.modified_at ? Date.parse(b.modified_at) : 0;
      return tb - ta;
    });
    const name = list[0]?.name?.trim();
    return name || null;
  } catch {
    return null;
  }
}

export type ClineUpstreamKind = 'ollama' | 'lmstudio' | 'custom';

export function getClineUpstreamKind(baseUrl: string): ClineUpstreamKind {
  if (isOllamaClineUpstream(baseUrl)) return 'ollama';
  const b = normalizeBaseUrl(baseUrl);
  const lmstudio = process.env.LMSTUDIO_BASE_URL?.trim();
  if (
    (lmstudio && basesProbablySameOpenAiHost(b, normalizeBaseUrl(lmstudio))) ||
    looksLikeLmStudioOpenAiBase(b)
  ) {
    return 'lmstudio';
  }
  return 'custom';
}

export function getResolvedBaseHostHint(baseUrl: string): string {
  try {
    const u = new URL(baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return `${u.hostname}:${port}`;
  } catch {
    return 'unknown';
  }
}

/**
 * Pick a model id the upstream accepts. Cloud UI model ids (Groq, etc.) must not be sent to Ollama.
 * `clineDedicatedModel` comes from the Cline-only model UI (after CLINE_DEFAULT_MODEL env).
 */
export function resolveClineUpstreamModel(
  baseUrl: string,
  uiModel?: string,
  clineDedicatedModel?: string
): string {
  const forced = process.env.CLINE_DEFAULT_MODEL?.trim();
  if (forced) return forced;

  const dedicated = clineDedicatedModel?.trim();
  if (dedicated) return dedicated;

  const b = normalizeBaseUrl(baseUrl);
  const lmstudio = process.env.LMSTUDIO_BASE_URL?.trim();

  if (isOllamaClineUpstream(baseUrl)) {
    return process.env.OLLAMA_MODEL?.trim() || 'llama3.2:latest';
  }

  const lmHost =
    (lmstudio && basesProbablySameOpenAiHost(b, normalizeBaseUrl(lmstudio))) ||
    looksLikeLmStudioOpenAiBase(b);
  if (lmHost) {
    return uiModel?.trim() || 'local-model';
  }

  if (isGroqClineUpstream(baseUrl)) {
    const u = uiModel?.trim();
    if (u && looksLikeGroqOpenAiModelId(u)) return u;
    return process.env.GROQ_DEFAULT_MODEL?.trim() || 'llama-3.3-70b-versatile';
  }

  return uiModel?.trim() || 'gpt-4o-mini';
}

/** Bearer for OpenAI-compatible upstream; reuse GROQ_API_KEY on Groq hosts. */
export function getClineAuthToken(baseUrl?: string): string | undefined {
  const explicit = process.env.CLINE_AUTH_TOKEN?.trim();
  if (explicit) return explicit;
  if (baseUrl && isGroqClineUpstream(baseUrl)) {
    return process.env.GROQ_API_KEY?.trim() || undefined;
  }
  return undefined;
}

export function parseClineAgentIds(): string[] {
  const raw = process.env.CLINE_AGENT_IDS?.trim();
  if (!raw) return ['default'];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : ['default'];
}

function augmentMessages(input: ClineProxyInput): { role: string; content: string }[] {
  const parts: string[] = [];
  if (input.workspaceRoot) {
    parts.push(`Workspace root (server): ${input.workspaceRoot}`);
  }
  if (input.terminalContext) {
    parts.push('Terminal snapshot:\n```\n' + input.terminalContext.slice(-12000) + '\n```');
  }
  if (input.errorContext) {
    parts.push('User-attached error:\n```\n' + input.errorContext + '\n```');
  }
  const sys = parts.length ? [{ role: 'system' as const, content: parts.join('\n\n') }] : [];
  return [...sys, ...input.messages];
}

function buildUpstreamUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${p}`;
}

export async function listClineUpstreamModels(baseUrl: string): Promise<{
  models: { id: string }[];
  hint?: string;
}> {
  if (isOllamaClineUpstream(baseUrl)) {
    try {
      const root = normalizeBaseUrl(baseUrl);
      const r = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return { models: [], hint: `Ollama /api/tags HTTP ${r.status}` };
      const j = (await r.json()) as { models?: Array<{ name: string }> };
      const models = (j.models ?? [])
        .map((m) => ({ id: (m.name || '').trim() }))
        .filter((m) => m.id);
      return {
        models,
        hint: models.length ? undefined : 'No models; run ollama pull <name>',
      };
    } catch (e) {
      return {
        models: [],
        hint: e instanceof Error ? e.message : 'Failed to reach Ollama /api/tags',
      };
    }
  }

  const headers: Record<string, string> = {};
  const token = getClineAuthToken(baseUrl);
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const url = buildUpstreamUrl(baseUrl, '/v1/models');
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      const t = await r.text();
      return { models: [], hint: `GET /v1/models → ${r.status} ${t.slice(0, 180)}` };
    }
    const j = (await r.json()) as { data?: Array<{ id?: string }> };
    const models = (j.data ?? [])
      .map((m) => ({ id: (m.id || '').trim() }))
      .filter((m) => m.id);
    return {
      models,
      hint: models.length ? undefined : 'Upstream returned an empty model list',
    };
  } catch (e) {
    return {
      models: [],
      hint: e instanceof Error ? e.message : 'Failed to fetch /v1/models',
    };
  }
}

export async function checkClineUpstreamHealth(baseUrl: string): Promise<{
  ok: boolean;
  upstreamKind: ClineUpstreamKind;
  resolvedBaseHost: string;
  error?: string;
}> {
  const upstreamKind = getClineUpstreamKind(baseUrl);
  const resolvedBaseHost = getResolvedBaseHostHint(baseUrl);
  try {
    if (isOllamaClineUpstream(baseUrl)) {
      const r = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) {
        return {
          ok: false,
          upstreamKind,
          resolvedBaseHost,
          error: `Ollama /api/tags HTTP ${r.status}`,
        };
      }
      return { ok: true, upstreamKind, resolvedBaseHost };
    }
    const headers: Record<string, string> = {};
    const token = getClineAuthToken(baseUrl);
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(buildUpstreamUrl(baseUrl, '/v1/models'), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) {
      const t = await r.text();
      return {
        ok: false,
        upstreamKind,
        resolvedBaseHost,
        error: `/v1/models HTTP ${r.status}: ${t.slice(0, 120)}`,
      };
    }
    return { ok: true, upstreamKind, resolvedBaseHost };
  } catch (e) {
    return {
      ok: false,
      upstreamKind,
      resolvedBaseHost,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Turn undici "fetch failed" + errno into an actionable message for the UI. */
export function formatClineConnectionError(err: unknown, upstreamUrl: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  let code: string | undefined;
  const c = err instanceof Error ? err.cause : undefined;
  if (c && typeof c === 'object' && 'code' in c && typeof (c as { code?: string }).code === 'string') {
    code = (c as NodeJS.ErrnoException).code;
  }
  if (!code && err instanceof Error && 'code' in err) {
    code = (err as NodeJS.ErrnoException).code;
  }

  switch (code) {
    case 'ECONNREFUSED':
      return `Cannot connect to Cline bridge at ${upstreamUrl} (connection refused). If using Ollama, run \`ollama serve\` and ensure OLLAMA_BASE_URL matches (see .env.example). Otherwise start your gateway or fix “Cline local URL” in ⚙.`;
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Cannot resolve host for Cline bridge (${upstreamUrl}). Check “Cline local URL” in settings.`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      return `Connection to Cline bridge timed out (${upstreamUrl}).`;
    default:
      break;
  }
  if (msg === 'fetch failed') {
    return code
      ? `Cannot reach Cline bridge (${upstreamUrl}): ${code}`
      : `Cannot reach Cline bridge (${upstreamUrl}).`;
  }
  return msg;
}

export async function* streamClinePlainText(input: ClineProxyInput): AsyncGenerator<string, void, void> {
  const url = buildUpstreamUrl(input.baseUrl, input.chatPath || getDefaultClineChatPath());
  const streamMode = input.streamMode || getDefaultClineStreamMode();

  const body: Record<string, unknown> = {
    model: input.model,
    messages: augmentMessages(input),
    stream: streamMode === 'openai_sse',
  };

  const agentField = process.env.CLINE_BODY_AGENT_FIELD?.trim() || 'cline_agent_id';
  if (input.clineAgentId && input.clineAgentId !== 'default') {
    body[agentField] = input.clineAgentId;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = input.authToken || getClineAuthToken(input.baseUrl);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: input.signal,
    });
  } catch (e) {
    throw new Error(formatClineConnectionError(e, url));
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Cline gateway ${res.status}: ${t.slice(0, 2000)}`);
  }

  if (streamMode === 'text') {
    const reader = res.body?.getReader();
    if (!reader) return;
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const chunk =
          j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? '';
        if (chunk) yield chunk;
      } catch {
        /* ignore partial JSON */
      }
    }
  }
}
