import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/client';
import {
  keyPresenceFromKeys,
  mergeApiKeysPatch,
  parseApiKeysJson,
  stringifyApiKeys,
} from '../lib/appPrefs';

export const persistenceRouter = Router();

const providerIdSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'groq',
  'mistral',
  'ollama',
  'lmstudio',
  'custom',
]);

const agentBackendSchema = z.enum(['langchain', 'cline']);

const apiKeysPatchSchema = z.record(z.string().max(16384)).optional();

const prefsPutSchema = z.object({
  selectedProvider: providerIdSchema,
  selectedModel: z.string().min(1).max(512),
  activeConversationId: z.string().uuid().nullable().optional(),
  agentBackend: agentBackendSchema.optional(),
  clineModel: z.string().max(512).optional(),
  apiKeys: apiKeysPatchSchema,
  customBaseUrl: z.string().max(2048).optional(),
  workspaceRoot: z.string().max(4096).optional(),
  clineLocalBaseUrl: z.string().max(2048).optional(),
  clineAgentId: z.string().max(256).optional(),
  clineAutoFallbackOnError: z.boolean().optional(),
  agentPanelOpen: z.boolean().optional(),
  historyPanelOpen: z.boolean().optional(),
});

function normalizeStoredClineLocalUrl(raw: string): string {
  const t = raw.trim();
  const n = t.replace(/\/$/, '');
  if (n === 'http://127.0.0.1:8787' || n === 'http://localhost:8787') return '';
  return t;
}

const terminalPayloadSchema = z.object({
  sessions: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(0).max(256),
      })
    )
    .min(1),
  activeSessionId: z.string().min(1).max(64),
  focusedSessionId: z.string().min(1).max(64),
  layout: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('tabs') }),
    z.object({
      mode: z.literal('split-h'),
      left: z.string().min(1).max(64),
      right: z.string().min(1).max(64),
    }),
    z.object({
      mode: z.literal('split-v'),
      top: z.string().min(1).max(64),
      bottom: z.string().min(1).max(64),
    }),
  ]),
});

const messagePostSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(2_000_000),
});

const conversationPatchSchema = z.object({
  title: z.string().min(0).max(512).optional(),
  archived: z.boolean().optional(),
});

persistenceRouter.get('/prefs', (_req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT selected_provider, selected_model, agent_mode, active_conversation_id,
              agent_backend, cline_model,
              api_keys_json, custom_base_url, workspace_root, cline_local_base_url,
              cline_agent_id, cline_auto_fallback_on_error, agent_panel_open, history_panel_open
       FROM app_prefs WHERE id = 1`
    )
    .get() as {
    selected_provider: string;
    selected_model: string;
    agent_mode: number;
    active_conversation_id: string | null;
    agent_backend: string | null;
    cline_model: string | null;
    api_keys_json: string;
    custom_base_url: string;
    workspace_root: string;
    cline_local_base_url: string;
    cline_agent_id: string;
    cline_auto_fallback_on_error: number;
    agent_panel_open: number;
    history_panel_open: number;
  };
  const keys = parseApiKeysJson(row.api_keys_json ?? '{}');
  res.json({
    selectedProvider: row.selected_provider,
    selectedModel: row.selected_model,
    activeConversationId: row.active_conversation_id,
    agentBackend: (row.agent_backend === 'cline' ? 'cline' : 'langchain') as
      | 'langchain'
      | 'cline',
    clineModel: row.cline_model ?? '',
    keyPresence: keyPresenceFromKeys(keys),
    customBaseUrl: row.custom_base_url ?? '',
    workspaceRoot: row.workspace_root ?? '',
    clineLocalBaseUrl: row.cline_local_base_url ?? '',
    clineAgentId: row.cline_agent_id ?? 'default',
    clineAutoFallbackOnError: (row.cline_auto_fallback_on_error ?? 1) === 1,
    agentPanelOpen: (row.agent_panel_open ?? 1) === 1,
    historyPanelOpen: (row.history_panel_open ?? 1) === 1,
  });
});

persistenceRouter.put('/prefs', (req: Request, res: Response) => {
  const parsed = prefsPutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT agent_backend, cline_model, api_keys_json, custom_base_url, workspace_root,
              cline_local_base_url, cline_agent_id, cline_auto_fallback_on_error,
              agent_panel_open, history_panel_open
       FROM app_prefs WHERE id = 1`
    )
    .get() as
    | {
        agent_backend: string | null;
        cline_model: string | null;
        api_keys_json: string;
        custom_base_url: string;
        workspace_root: string;
        cline_local_base_url: string;
        cline_agent_id: string;
        cline_auto_fallback_on_error: number;
        agent_panel_open: number;
        history_panel_open: number;
      }
    | undefined;

  const ab =
    data.agentBackend ??
    (existing?.agent_backend === 'cline' || existing?.agent_backend === 'langchain'
      ? existing.agent_backend
      : 'langchain');
  const cm = data.clineModel !== undefined ? data.clineModel : (existing?.cline_model ?? '');

  const prevKeys = parseApiKeysJson(existing?.api_keys_json ?? '{}');
  const mergedKeys = mergeApiKeysPatch(prevKeys, data.apiKeys);
  const apiKeysJson = stringifyApiKeys(mergedKeys);

  const customBaseUrl =
    data.customBaseUrl !== undefined ? data.customBaseUrl : (existing?.custom_base_url ?? '');
  const workspaceRoot =
    data.workspaceRoot !== undefined ? data.workspaceRoot : (existing?.workspace_root ?? '');
  const clineLocalRaw =
    data.clineLocalBaseUrl !== undefined
      ? data.clineLocalBaseUrl
      : (existing?.cline_local_base_url ?? '');
  const clineLocalBaseUrl = normalizeStoredClineLocalUrl(clineLocalRaw);

  const clineAgentId =
    data.clineAgentId !== undefined ? data.clineAgentId : (existing?.cline_agent_id ?? 'default');
  const clineAutoFallbackOnError =
    data.clineAutoFallbackOnError !== undefined
      ? data.clineAutoFallbackOnError
      : (existing?.cline_auto_fallback_on_error ?? 1) === 1;
  const agentPanelOpen =
    data.agentPanelOpen !== undefined
      ? data.agentPanelOpen
      : (existing?.agent_panel_open ?? 1) === 1;
  const historyPanelOpen =
    data.historyPanelOpen !== undefined
      ? data.historyPanelOpen
      : (existing?.history_panel_open ?? 1) === 1;

  db.prepare(
    `UPDATE app_prefs SET
      selected_provider = ?,
      selected_model = ?,
      agent_mode = 1,
      active_conversation_id = ?,
      agent_backend = ?,
      cline_model = ?,
      api_keys_json = ?,
      custom_base_url = ?,
      workspace_root = ?,
      cline_local_base_url = ?,
      cline_agent_id = ?,
      cline_auto_fallback_on_error = ?,
      agent_panel_open = ?,
      history_panel_open = ?
     WHERE id = 1`
  ).run(
    data.selectedProvider,
    data.selectedModel,
    data.activeConversationId ?? null,
    ab,
    cm,
    apiKeysJson,
    customBaseUrl,
    workspaceRoot,
    clineLocalBaseUrl,
    clineAgentId,
    clineAutoFallbackOnError ? 1 : 0,
    agentPanelOpen ? 1 : 0,
    historyPanelOpen ? 1 : 0
  );
  res.json({ ok: true });
});

persistenceRouter.get('/conversations', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, created_at, updated_at, archived
       FROM conversations
       WHERE archived = 0
       ORDER BY updated_at DESC`
    )
    .all() as {
    id: string;
    title: string | null;
    created_at: number;
    updated_at: number;
    archived: number;
  }[];
  res.json({
    conversations: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      archived: r.archived === 1,
    })),
  });
});

persistenceRouter.post('/conversations', (req: Request, res: Response) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.slice(0, 512) : null;
  const id = randomUUID();
  const now = Date.now();
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, title, created_at, updated_at, archived)
     VALUES (?, ?, ?, ?, 0)`
  ).run(id, title, now, now);
  res.status(201).json({
    id,
    title,
    createdAt: now,
    updatedAt: now,
    archived: false,
  });
});

persistenceRouter.patch('/conversations/:id', (req: Request, res: Response) => {
  const parsed = conversationPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const id = req.params.id;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
  if (!exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const sets: string[] = ['updated_at = ?'];
  const args: (string | number)[] = [Date.now()];
  if (parsed.data.title !== undefined) {
    sets.push('title = ?');
    args.push(parsed.data.title);
  }
  if (parsed.data.archived !== undefined) {
    sets.push('archived = ?');
    args.push(parsed.data.archived ? 1 : 0);
  }
  args.push(id);
  db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  res.json({ ok: true });
});

persistenceRouter.delete('/conversations/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const db = getDb();
  const r = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  if (r.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  db.prepare(
    `UPDATE app_prefs SET active_conversation_id = CASE
      WHEN active_conversation_id = ? THEN NULL
      ELSE active_conversation_id
     END WHERE id = 1`
  ).run(id);
  res.json({ ok: true });
});

persistenceRouter.get('/conversations/:id/messages', (req: Request, res: Response) => {
  const id = req.params.id;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
  if (!exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const rows = db
    .prepare(
      `SELECT id, role, content, created_at FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(id) as { id: string; role: string; content: string; created_at: number }[];
  res.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
});

persistenceRouter.post('/conversations/:id/messages', (req: Request, res: Response) => {
  const parsed = messagePostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const convId = req.params.id;
  const db = getDb();
  const exists = db.prepare('SELECT id, title FROM conversations WHERE id = ?').get(convId) as
    | { id: string; title: string | null }
    | undefined;
  if (!exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const now = Date.now();
  const { id, role, content } = parsed.data;
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, convId, role, content, now);
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convId);

  if (role === 'user' && (!exists.title || exists.title.trim() === '')) {
    const snippet = content.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Chat';
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(snippet, convId);
  }

  res.status(201).json({ ok: true, id, createdAt: now });
});

persistenceRouter.get('/terminal-state', (_req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT payload FROM terminal_state WHERE id = 1').get() as
    | { payload: string }
    | undefined;
  const raw = row?.payload ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.json({ payload: null });
    return;
  }
  const safe = terminalPayloadSchema.safeParse(parsed);
  res.json({ payload: safe.success ? safe.data : null });
});

persistenceRouter.put('/terminal-state', (req: Request, res: Response) => {
  const parsed = terminalPayloadSchema.safeParse(req.body?.payload);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE terminal_state SET payload = ? WHERE id = 1').run(
    JSON.stringify(parsed.data)
  );
  res.json({ ok: true });
});
