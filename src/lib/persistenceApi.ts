import type { ProviderId } from '@/types/models';
import type { ChatMessage } from '@/types/chat';

export type PrefsAgentBackend = 'langchain' | 'cline';

export type HealthResponse = { ok: boolean; db?: boolean };

export type KeyPresence = Record<ProviderId, boolean>;

export type AppPrefsResponse = {
  selectedProvider: ProviderId;
  selectedModel: string;
  activeConversationId: string | null;
  agentBackend: PrefsAgentBackend;
  clineModel: string;
  keyPresence: KeyPresence;
  customBaseUrl: string;
  workspaceRoot: string;
  clineLocalBaseUrl: string;
  clineAgentId: string;
  clineAutoFallbackOnError: boolean;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
};

export type PutAppPrefsPayload = {
  selectedProvider: ProviderId;
  selectedModel: string;
  activeConversationId: string | null;
  agentBackend: PrefsAgentBackend;
  clineModel: string;
  customBaseUrl: string;
  workspaceRoot: string;
  clineLocalBaseUrl: string;
  clineAgentId: string;
  clineAutoFallbackOnError: boolean;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
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
    messages: { id: string; role: ChatMessage['role']; content: string }[];
  }>(res);
  return data.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));
}

export async function appendMessage(
  conversationId: string,
  message: Pick<ChatMessage, 'id' | 'role' | 'content'>
): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
    }),
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
