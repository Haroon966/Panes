import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/client';
import {
  normalizeAgentContextHints,
  normalizeAgentPinnedPathsArray,
  normalizeAgentPinnedPathsFromJson,
  normalizeAgentVerifyCommand,
  normalizeAgentVerbosity,
  type AgentVerbosity,
} from '../lib/agentStylePrefs';
import {
  keyPresenceFromKeys,
  mergeApiKeysPatch,
  parseApiKeysJson,
  stringifyApiKeys,
} from '../lib/appPrefs';
import {
  agentTraceEntrySchema,
  normalizeAgentTraceJson,
  parseAgentTraceColumn,
} from '../lib/agentTraceJson';

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

const colorSchemeSchema = z.enum(['dark', 'light', 'system']);

const agentVerbositySchema = z.enum(['concise', 'detailed', 'step_by_step']);

const CODE_FONT_SIZE_MIN = 10;
const CODE_FONT_SIZE_MAX = 22;
const CODE_FONT_SIZE_DEFAULT = 13;

function normalizeCodeFontSizePx(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return CODE_FONT_SIZE_DEFAULT;
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, Math.round(n)));
}

const apiKeysPatchSchema = z.record(z.string().max(16384)).optional();

export const prefsPutSchema = z.object({
  selectedProvider: providerIdSchema,
  selectedModel: z.string().min(1).max(512),
  activeConversationId: z.string().uuid().nullable().optional(),
  apiKeys: apiKeysPatchSchema,
  customBaseUrl: z.string().max(2048).optional(),
  workspaceRoot: z.string().max(4096).optional(),
  /** One shell command for `run_project_verify_command` (e.g. npm test). */
  agentVerifyCommand: z.string().max(2048).optional(),
  agentPanelOpen: z.boolean().optional(),
  historyPanelOpen: z.boolean().optional(),
  colorScheme: colorSchemeSchema.optional(),
  codeFontSizePx: z
    .number()
    .int()
    .min(CODE_FONT_SIZE_MIN)
    .max(CODE_FONT_SIZE_MAX)
    .optional(),
  agentVerbosity: agentVerbositySchema.optional(),
  agentContextHints: z.string().max(4000).optional(),
  /** true = follow env HITL only; false = always confirm file/shell mutations in UI. */
  agentAutoMode: z.boolean().optional(),
  /** Workspace-relative paths (max 8) inlined into the agent system prompt. */
  agentPinnedPaths: z.array(z.string().min(1).max(512)).max(8).optional(),
  /** When true, workspace editor runs Monaco formatDocument before manual save (not auto-save). */
  workspaceFormatOnSave: z.boolean().optional(),
});

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

const messageAlternateSchema = z.object({
  id: z.string().min(1).max(128),
  content: z.string().max(2_000_000),
  createdAt: z.number().int().nonnegative(),
});

const agentTraceSchema = z.array(agentTraceEntrySchema).max(400);

const messagePostSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(2_000_000),
  alternates: z.array(messageAlternateSchema).optional(),
  agentTrace: agentTraceSchema.optional(),
});

const messagePatchSchema = z.object({
  content: z.string().max(2_000_000).optional(),
  alternates: z.array(messageAlternateSchema).optional(),
  activateAlternateId: z.string().min(1).max(128).optional(),
  agentTrace: agentTraceSchema.optional(),
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
              api_keys_json, custom_base_url, workspace_root,
              agent_panel_open, history_panel_open,
              color_scheme, code_font_size_px,
              agent_verbosity, agent_context_hints, agent_pinned_paths_json,
              workspace_format_on_save, agent_verify_command
       FROM app_prefs WHERE id = 1`
    )
    .get() as {
    selected_provider: string;
    selected_model: string;
    agent_mode: number;
    active_conversation_id: string | null;
    api_keys_json: string;
    custom_base_url: string;
    workspace_root: string;
    agent_panel_open: number;
    history_panel_open: number;
    color_scheme: string | null;
    code_font_size_px: number | null;
    agent_verbosity: string | null;
    agent_context_hints: string | null;
    agent_pinned_paths_json: string | null;
    workspace_format_on_save: number | null;
    agent_verify_command: string | null;
  };
  const keys = parseApiKeysJson(row.api_keys_json ?? '{}');
  const cs = row.color_scheme;
  const colorScheme =
    cs === 'light' || cs === 'system' ? cs : 'dark';
  const codeFontSizePx = normalizeCodeFontSizePx(row.code_font_size_px);
  const agentVerbosity = normalizeAgentVerbosity(row.agent_verbosity);
  const agentContextHints = normalizeAgentContextHints(row.agent_context_hints);
  const agentAutoMode = row.agent_mode === 1;
  const agentPinnedPaths = normalizeAgentPinnedPathsFromJson(row.agent_pinned_paths_json);
  const workspaceFormatOnSave = (row.workspace_format_on_save ?? 0) === 1;
  res.json({
    selectedProvider: row.selected_provider,
    selectedModel: row.selected_model,
    activeConversationId: row.active_conversation_id,
    keyPresence: keyPresenceFromKeys(keys),
    customBaseUrl: row.custom_base_url ?? '',
    workspaceRoot: row.workspace_root ?? '',
    agentVerifyCommand: normalizeAgentVerifyCommand(row.agent_verify_command ?? ''),
    agentPanelOpen: (row.agent_panel_open ?? 1) === 1,
    historyPanelOpen: (row.history_panel_open ?? 1) === 1,
    colorScheme,
    codeFontSizePx,
    agentVerbosity,
    agentContextHints,
    agentAutoMode,
    agentPinnedPaths,
    workspaceFormatOnSave,
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
      `SELECT api_keys_json, custom_base_url, workspace_root,
              agent_panel_open, history_panel_open, color_scheme, code_font_size_px,
              agent_verbosity, agent_context_hints, agent_mode, agent_pinned_paths_json,
              workspace_format_on_save, agent_verify_command
       FROM app_prefs WHERE id = 1`
    )
    .get() as
    | {
        api_keys_json: string;
        custom_base_url: string;
        workspace_root: string;
        agent_panel_open: number;
        history_panel_open: number;
        color_scheme: string | null;
        code_font_size_px: number | null;
        agent_verbosity: string | null;
        agent_context_hints: string | null;
        agent_mode: number;
        agent_pinned_paths_json: string | null;
        workspace_format_on_save: number | null;
        agent_verify_command: string | null;
      }
    | undefined;

  const prevKeys = parseApiKeysJson(existing?.api_keys_json ?? '{}');
  const mergedKeys = mergeApiKeysPatch(prevKeys, data.apiKeys);
  const apiKeysJson = stringifyApiKeys(mergedKeys);

  const customBaseUrl =
    data.customBaseUrl !== undefined ? data.customBaseUrl : (existing?.custom_base_url ?? '');
  const workspaceRoot =
    data.workspaceRoot !== undefined ? data.workspaceRoot : (existing?.workspace_root ?? '');
  const agentVerifyCommand = normalizeAgentVerifyCommand(
    data.agentVerifyCommand !== undefined
      ? data.agentVerifyCommand
      : (existing?.agent_verify_command ?? '')
  );
  const agentPanelOpen =
    data.agentPanelOpen !== undefined
      ? data.agentPanelOpen
      : (existing?.agent_panel_open ?? 1) === 1;
  const historyPanelOpen =
    data.historyPanelOpen !== undefined
      ? data.historyPanelOpen
      : (existing?.history_panel_open ?? 1) === 1;

  const prevCs = existing?.color_scheme;
  const colorSchemeRaw =
    data.colorScheme !== undefined
      ? data.colorScheme
      : prevCs === 'light' || prevCs === 'system'
        ? prevCs
        : 'dark';

  const codeFontSizePx =
    data.codeFontSizePx !== undefined
      ? data.codeFontSizePx
      : normalizeCodeFontSizePx(existing?.code_font_size_px);

  const agentVerbosity: AgentVerbosity =
    data.agentVerbosity !== undefined
      ? data.agentVerbosity
      : normalizeAgentVerbosity(existing?.agent_verbosity);
  const agentContextHints =
    data.agentContextHints !== undefined
      ? normalizeAgentContextHints(data.agentContextHints)
      : normalizeAgentContextHints(existing?.agent_context_hints);

  const agentMode =
    data.agentAutoMode !== undefined
      ? data.agentAutoMode
        ? 1
        : 0
      : existing?.agent_mode === 0
        ? 0
        : 1;

  const agentPinnedPaths =
    data.agentPinnedPaths !== undefined
      ? normalizeAgentPinnedPathsArray(data.agentPinnedPaths)
      : normalizeAgentPinnedPathsFromJson(existing?.agent_pinned_paths_json);
  const agentPinnedPathsJson = JSON.stringify(agentPinnedPaths);

  const workspaceFormatOnSave =
    data.workspaceFormatOnSave !== undefined
      ? data.workspaceFormatOnSave
      : (existing?.workspace_format_on_save ?? 0) === 1;

  db.prepare(
    `UPDATE app_prefs SET
      selected_provider = ?,
      selected_model = ?,
      agent_mode = ?,
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
      history_panel_open = ?,
      color_scheme = ?,
      code_font_size_px = ?,
      agent_verbosity = ?,
      agent_context_hints = ?,
      agent_pinned_paths_json = ?,
      workspace_format_on_save = ?,
      agent_verify_command = ?
     WHERE id = 1`
  ).run(
    data.selectedProvider,
    data.selectedModel,
    agentMode,
    data.activeConversationId ?? null,
    'langchain',
    '',
    apiKeysJson,
    customBaseUrl,
    workspaceRoot,
    '',
    'default',
    1,
    agentPanelOpen ? 1 : 0,
    historyPanelOpen ? 1 : 0,
    colorSchemeRaw,
    codeFontSizePx,
    agentVerbosity,
    agentContextHints,
    agentPinnedPathsJson,
    workspaceFormatOnSave ? 1 : 0,
    agentVerifyCommand
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

function parseAlternatesColumn(raw: string | null | undefined): z.infer<typeof messageAlternateSchema>[] {
  if (raw == null || raw === '') return [];
  try {
    const j = JSON.parse(raw) as unknown;
    const parsed = z.array(messageAlternateSchema).safeParse(j);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

persistenceRouter.delete('/conversations/:id/messages', (req: Request, res: Response) => {
  const convId = req.params.id;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  if (!exists) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const afterMessageId =
    typeof req.query.afterMessageId === 'string' && req.query.afterMessageId.trim()
      ? req.query.afterMessageId.trim()
      : undefined;
  const now = Date.now();
  if (afterMessageId) {
    const anchor = db
      .prepare('SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?')
      .get(afterMessageId, convId) as { created_at: number } | undefined;
    if (!anchor) {
      res.status(404).json({ error: 'Anchor message not found' });
      return;
    }
    db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?').run(
      convId,
      anchor.created_at
    );
  } else {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(convId);
  }
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convId);
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
      `SELECT id, role, content, created_at,
              COALESCE(alternates_json, '[]') AS alternates_json,
              COALESCE(agent_trace_json, '[]') AS agent_trace_json
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(id) as {
    id: string;
    role: string;
    content: string;
    created_at: number;
    alternates_json: string;
    agent_trace_json: string;
  }[];
  res.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      alternates: parseAlternatesColumn(m.alternates_json),
      agentTrace: parseAgentTraceColumn(m.agent_trace_json),
    })),
  });
});

persistenceRouter.patch('/conversations/:id/messages/:messageId', (req: Request, res: Response) => {
  const convId = req.params.id;
  const messageId = req.params.messageId;
  const parsed = messagePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, content, COALESCE(alternates_json, '[]') AS alternates_json,
              COALESCE(agent_trace_json, '[]') AS agent_trace_json
       FROM messages WHERE id = ? AND conversation_id = ?`
    )
    .get(messageId, convId) as
    | {
        id: string;
        content: string;
        alternates_json: string;
        agent_trace_json: string;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  let content = row.content;
  let alternates = parseAlternatesColumn(row.alternates_json);
  let agentTraceJson = normalizeAgentTraceJson(row.agent_trace_json);

  if (parsed.data.activateAlternateId) {
    const aid = parsed.data.activateAlternateId;
    const idx = alternates.findIndex((a) => a.id === aid);
    if (idx === -1) {
      res.status(400).json({ error: 'Alternate id not found' });
      return;
    }
    const chosen = alternates[idx]!;
    const oldActive = content;
    content = chosen.content;
    alternates = [...alternates.slice(0, idx), ...alternates.slice(idx + 1)];
    alternates.push({
      id: randomUUID(),
      content: oldActive,
      createdAt: Date.now(),
    });
  }

  if (parsed.data.content !== undefined) content = parsed.data.content;
  if (parsed.data.alternates !== undefined) alternates = parsed.data.alternates;
  if (parsed.data.agentTrace !== undefined) {
    agentTraceJson = normalizeAgentTraceJson(JSON.stringify(parsed.data.agentTrace));
  }

  const now = Date.now();
  db.prepare(
    `UPDATE messages SET content = ?, alternates_json = ?, agent_trace_json = ? WHERE id = ? AND conversation_id = ?`
  ).run(content, JSON.stringify(alternates), agentTraceJson, messageId, convId);
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convId);
  res.json({ ok: true });
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
  const alternatesJson = JSON.stringify(parsed.data.alternates ?? []);
  const traceJson = normalizeAgentTraceJson(
    parsed.data.agentTrace != null ? JSON.stringify(parsed.data.agentTrace) : '[]'
  );
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at, alternates_json, agent_trace_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, convId, role, content, now, alternatesJson, traceJson);
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
