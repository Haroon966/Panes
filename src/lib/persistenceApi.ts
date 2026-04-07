import type { ProviderId } from '@/types/models';
import type { AgentTraceEntry } from '@/types/agentTrace';
import type { ChatMessage, MessageAlternate } from '@/types/chat';

export type PrefsColorScheme = 'dark' | 'light' | 'system';

export type PrefsAgentVerbosity = 'concise' | 'detailed' | 'step_by_step';

export type HealthResponse = { ok: boolean; db?: boolean };

export type KeyPresence = Record<ProviderId, boolean>;

export type AppPrefsResponse = {
  selectedProvider: ProviderId;
  selectedModel: string;
  activeConversationId: string | null;
  keyPresence: KeyPresence;
  customBaseUrl: string;
  workspaceRoot: string;
  /** Saved shell command for agent tool run_project_verify_command. */
  agentVerifyCommand: string;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
  /** Omitted if the API server predates the `color_scheme` column; client defaults to `dark`. */
  colorScheme?: PrefsColorScheme;
  /** Omitted if the API predates `code_font_size_px`; client defaults to 13. */
  codeFontSizePx?: number;
  /** Omitted if the API predates `agent_verbosity`; client defaults to `detailed`. */
  agentVerbosity?: PrefsAgentVerbosity;
  /** Omitted if the API predates `agent_context_hints`; client defaults to empty. */
  agentContextHints?: string;
  /** Omitted if the API predates exposure of `agent_mode`; client defaults to `true` (auto). */
  agentAutoMode?: boolean;
  /** Omitted if the API predates `agent_pinned_paths_json`; client defaults to `[]`. */
  agentPinnedPaths?: string[];
  /** Omitted if the API predates `workspace_format_on_save`; client defaults to `false`. */
  workspaceFormatOnSave?: boolean;
};

/** Mirrors `PUT /api/prefs` (SQLite `app_prefs`). */
export type PutAppPrefsPayload = {
  selectedProvider: ProviderId;
  selectedModel: string;
  activeConversationId: string | null;
  customBaseUrl: string;
  /** Working directory from the terminal (private OSC); not set from Manage API Keys. */
  workspaceRoot: string;
  agentVerifyCommand: string;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
  colorScheme: PrefsColorScheme;
  codeFontSizePx: number;
  agentVerbosity: PrefsAgentVerbosity;
  agentContextHints: string;
  /** When false, file/shell tools always require UI approval first. */
  agentAutoMode: boolean;
  /** Workspace-relative paths (max 8) included in the agent system prompt. */
  agentPinnedPaths: string[];
  /** Monaco formatDocument before manual workspace save (Ctrl+S); not used for timed auto-save. */
  workspaceFormatOnSave: boolean;
  apiKeys?: Record<string, string>;
};

export type ConversationRow = {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  return parseJson<HealthResponse>(res);
}

export async function getPrefs(): Promise<AppPrefsResponse> {
  const res = await fetch('/api/prefs');
  return parseJson<AppPrefsResponse>(res);
}

export async function putPrefs(prefs: PutAppPrefsPayload): Promise<void> {
  const res = await fetch('/api/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  await parseJson(res);
}

export async function listConversations(): Promise<ConversationRow[]> {
  const res = await fetch('/api/conversations');
  const data = await parseJson<{ conversations: ConversationRow[] }>(res);
  return data.conversations;
}

export async function createConversation(title?: string | null): Promise<ConversationRow> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(title != null ? { title } : {}),
  });
  return parseJson<ConversationRow>(res);
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  const data = await parseJson<{
    messages: {
      id: string;
      role: ChatMessage['role'];
      content: string;
      createdAt: number;
      alternates?: MessageAlternate[];
      agentTrace?: AgentTraceEntry[];
    }[];
  }>(res);
  return data.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    alternates: m.alternates?.length ? m.alternates : undefined,
    agentTrace: m.agentTrace?.length ? m.agentTrace : undefined,
  }));
}

export async function appendMessage(
  conversationId: string,
  message: Pick<ChatMessage, 'id' | 'role' | 'content'> & {
    alternates?: MessageAlternate[];
    agentTrace?: AgentTraceEntry[];
  }
): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      ...(message.alternates?.length ? { alternates: message.alternates } : {}),
      ...(message.agentTrace?.length ? { agentTrace: message.agentTrace } : {}),
    }),
  });
  await parseJson(res);
}

export async function patchMessage(
  conversationId: string,
  messageId: string,
  body: {
    content?: string;
    alternates?: MessageAlternate[];
    activateAlternateId?: string;
    agentTrace?: AgentTraceEntry[];
  }
): Promise<void> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  await parseJson(res);
}

export async function clearConversationMessages(conversationId: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'DELETE',
  });
  await parseJson(res);
}

export async function deleteConversationMessagesAfter(
  conversationId: string,
  afterMessageId: string
): Promise<void> {
  const q = new URLSearchParams({ afterMessageId });
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages?${q.toString()}`,
    { method: 'DELETE' }
  );
  await parseJson(res);
}

export async function patchConversation(
  conversationId: string,
  patch: { title: string }
): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  await parseJson(res);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
  await parseJson(res);
}

export async function getTerminalStatePayload(): Promise<unknown | null> {
  const res = await fetch('/api/terminal-state');
  const data = await parseJson<{ payload: unknown | null }>(res);
  return data.payload;
}

export async function putTerminalStatePayload(payload: unknown): Promise<void> {
  const res = await fetch('/api/terminal-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  await parseJson(res);
}
