import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat';
import * as persistenceApi from '@/lib/persistenceApi';
import type { ConversationRow, PutAppPrefsPayload } from '@/lib/persistenceApi';
import { createAgentStreamFeed } from '@/lib/agentStreamProtocol';
import type { TerminalAiApprovalEvent } from '@/lib/agentStreamProtocol';
import { useSettingsStore } from './settingsStore';
import { useTerminalStore } from './terminalStore';

function id(): string {
  return crypto.randomUUID();
}

function formatHttpErrorBody(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { error?: string };
    if (typeof j?.error === 'string' && j.error.trim()) return j.error;
  } catch {
    /* ignore */
  }
  const t = body.trim();
  return t ? `${status} ${t}` : String(status);
}

const CLINE_FALLBACK_NOTE =
  '\n\nSwitched agent to TerminalAI (LangChain). For Cline + Ollama: run `ollama serve`, `ollama pull llama3.2` (or set CLINE_DEFAULT_MODEL), keep OLLAMA_BASE_URL in server .env, then pick Cline again.';

function shouldAutoFallbackFromClineFailure(status: number, detail: string): boolean {
  if (detail.includes('Cline upstream URL missing') || detail.includes('Cline base URL missing')) return true;
  if (status !== 502) return false;
  return (
    detail.includes('Cannot connect to Cline bridge') ||
    detail.includes('Cannot reach Cline bridge') ||
    detail.toLowerCase().includes('connection refused')
  );
}

export type HitlApprovalRow = TerminalAiApprovalEvent & {
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
};

async function persistAssistantIfNeeded(): Promise<void> {
  const { messages, activeConversationId } = useChatStore.getState();
  const last = messages[messages.length - 1];
  if (!activeConversationId || last?.role !== 'assistant') return;
  try {
    await persistenceApi.appendMessage(activeConversationId, {
      id: last.id,
      role: last.role,
      content: last.content,
    });
    const list = await persistenceApi.listConversations();
    useChatStore.setState({ conversations: list });
  } catch (e) {
    console.warn('[TerminalAI] Failed to persist assistant message', e);
  }
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  pendingErrorContext: string | null;
  focusChatNonce: number;
  abortController: AbortController | null;
  conversations: ConversationRow[];
  activeConversationId: string | null;
  hitlApprovals: HitlApprovalRow[];
  setInput: (v: string) => void;
  setErrorContext: (ctx: string | null) => void;
  requestFocusChat: () => void;
  appendAssistantChunk: (chunk: string) => void;
  /** Append assistant text and persist when a conversation is active (e.g. after HITL approve). */
  appendAssistantChunkPersist: (chunk: string) => void;
  pushHitlApproval: (event: TerminalAiApprovalEvent) => void;
  resolveHitlApproval: (
    approvalId: string,
    status: 'approved' | 'rejected',
    feedback?: string
  ) => void;
  clearHitlApprovals: () => void;
  sendMessage: () => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
  setConversations: (rows: ConversationRow[]) => void;
  setActiveConversationId: (convId: string | null) => void;
  hydrateConversation: (convId: string | null, messages: ChatMessage[]) => void;
  newChat: () => Promise<void>;
  selectConversation: (convId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  deleteConversation: (convId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: '',
  isStreaming: false,
  pendingErrorContext: null,
  focusChatNonce: 0,
  abortController: null,
  conversations: [],
  activeConversationId: null,
  hitlApprovals: [],

  setInput: (v) => set({ input: v }),

  setErrorContext: (ctx) =>
    set((s) => ({
      pendingErrorContext: ctx,
      input: ctx ? `[Error from terminal]: ${ctx}` : s.input,
    })),

  requestFocusChat: () => set((s) => ({ focusChatNonce: s.focusChatNonce + 1 })),

  appendAssistantChunk: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      } else {
        msgs.push({ id: id(), role: 'assistant', content: chunk });
      }
      return { messages: msgs };
    }),

  appendAssistantChunkPersist: (chunk) => {
    get().appendAssistantChunk(chunk);
    void persistAssistantIfNeeded();
  },

  pushHitlApproval: (event) =>
    set((s) => {
      if (s.hitlApprovals.some((a) => a.approvalId === event.approvalId)) return s;
      const row: HitlApprovalRow = { ...event, status: 'pending' };
      return { hitlApprovals: [...s.hitlApprovals, row] };
    }),

  resolveHitlApproval: (approvalId, status, feedback) =>
    set((s) => ({
      hitlApprovals: s.hitlApprovals.map((a) =>
        a.approvalId === approvalId ? { ...a, status, feedback } : a
      ),
    })),

  clearHitlApprovals: () => set({ hitlApprovals: [] }),

  setConversations: (rows) => set({ conversations: rows }),

  setActiveConversationId: (convId) => set({ activeConversationId: convId }),

  hydrateConversation: (convId, messages) =>
    set({ activeConversationId: convId, messages, hitlApprovals: [] }),

  newChat: async () => {
    set({ messages: [], activeConversationId: null, hitlApprovals: [] });
    try {
      await flushPrefs();
    } catch (e) {
      console.warn('[TerminalAI] newChat failed to sync prefs', e);
    }
  },

  selectConversation: async (convId) => {
    try {
      const msgs = await persistenceApi.fetchMessages(convId);
      set({ activeConversationId: convId, messages: msgs, hitlApprovals: [] });
      await flushPrefs();
    } catch (e) {
      console.warn('[TerminalAI] selectConversation failed', e);
    }
  },

  refreshConversations: async () => {
    try {
      const list = await persistenceApi.listConversations();
      set({ conversations: list });
    } catch {
      /* offline */
    }
  },

  deleteConversation: async (convId) => {
    try {
      await persistenceApi.deleteConversation(convId);
    } catch (e) {
      console.warn('[TerminalAI] deleteConversation failed', e);
      return;
    }
    const { activeConversationId, conversations, isStreaming } = get();
    const wasActive = activeConversationId === convId;
    if (wasActive && isStreaming) {
      get().abortStream();
    }
    set({
      conversations: conversations.filter((c) => c.id !== convId),
      ...(wasActive ? { activeConversationId: null, messages: [] } : {}),
    });
    if (wasActive) {
      try {
        await flushPrefs();
      } catch (e) {
        console.warn('[TerminalAI] deleteConversation failed to sync prefs', e);
      }
    }
  },

  sendMessage: async () => {
    const raw = get().input.trim();
    if (!raw || get().isStreaming) return;

    const settings = useSettingsStore.getState();
    const errCtx = get().pendingErrorContext;
    const terminalCtx = useTerminalStore.getState().getTerminalContext();
    const terminalSessionId = useTerminalStore.getState().getShellConnectedSessionId();

    const userMsg: ChatMessage = { id: id(), role: 'user', content: raw };
    set((s) => ({
      messages: [...s.messages, userMsg],
      input: '',
      pendingErrorContext: null,
      isStreaming: true,
    }));

    const persistUser = async () => {
      let cid = get().activeConversationId;
      if (!cid) {
        try {
          const row = await persistenceApi.createConversation(null);
          set((s) => ({
            activeConversationId: row.id,
            conversations: [row, ...s.conversations.filter((c) => c.id !== row.id)],
          }));
          cid = row.id;
          await flushPrefs();
        } catch (e) {
          console.warn('[TerminalAI] Failed to create conversation for first message', e);
          return;
        }
      }
      try {
        await persistenceApi.appendMessage(cid, {
          id: userMsg.id,
          role: userMsg.role,
          content: userMsg.content,
        });
        await get().refreshConversations();
      } catch (e) {
        console.warn('[TerminalAI] Failed to persist user message', e);
      }
    };

    await persistUser();

    const ac = new AbortController();
    set({ abortController: ac });

    const messagesPayload = get().messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const useCline = settings.agentBackend === 'cline';
    const clineUrlResolved = settings.getClineLocalBaseUrl().trim();

    const langchainPayload = {
      messages: messagesPayload,
      provider: settings.selectedProvider,
      model: settings.selectedModel,
      errorContext: errCtx ?? undefined,
      terminalContext: terminalCtx || undefined,
      ...(terminalSessionId ? { terminalSessionId } : {}),
    };

    const clinePayload = {
      messages: messagesPayload,
      model: settings.selectedModel,
      provider: settings.selectedProvider,
      clineAgentId: settings.clineAgentId,
      ...(settings.clineModel.trim() ? { clineModel: settings.clineModel.trim() } : {}),
      errorContext: errCtx ?? undefined,
      terminalContext: terminalCtx || undefined,
      ...(terminalSessionId ? { terminalSessionId } : {}),
    };

    const endpoint = useCline ? '/api/agent/cline' : '/api/agent';
    const payload = useCline ? clinePayload : langchainPayload;

    if (useCline && !clineUrlResolved && useSettingsStore.getState().clineServerBaseConfigured === false) {
      const st = useSettingsStore.getState();
      if (st.clineAutoFallbackOnError) {
        st.setAgentBackend('langchain');
      }
      const msg =
        'No Cline upstream URL: the server has no CLINE_LOCAL_BASE_URL, OLLAMA_BASE_URL, or LMSTUDIO_BASE_URL. Copy .env.example → .env or set “Cline local URL” in ⚙.' +
        (st.clineAutoFallbackOnError ? CLINE_FALLBACK_NOTE : '');
      set((s) => ({
        messages: [...s.messages, { id: id(), role: 'assistant', content: msg }],
        isStreaming: false,
        abortController: null,
      }));
      await persistAssistantIfNeeded();
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = formatHttpErrorBody(res.status, errText);
        if (
          useCline &&
          endpoint === '/api/agent/cline' &&
          useSettingsStore.getState().clineAutoFallbackOnError &&
          shouldAutoFallbackFromClineFailure(res.status, detail)
        ) {
          useSettingsStore.getState().setAgentBackend('langchain');
          detail += CLINE_FALLBACK_NOTE;
        }
        set((s) => ({
          messages: [
            ...s.messages,
            { id: id(), role: 'assistant', content: detail },
          ],
          isStreaming: false,
          abortController: null,
        }));
        await persistAssistantIfNeeded();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        set({ isStreaming: false, abortController: null });
        return;
      }

      const dec = new TextDecoder();
      const streamFeed = createAgentStreamFeed({
        onVisible: (text) => get().appendAssistantChunk(text),
        onApproval: (ev) => get().pushHitlApproval(ev),
      });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        streamFeed.push(chunk);
      }
      streamFeed.finish();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        set({
          isStreaming: false,
          abortController: null,
        });
        return;
      }
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: id(),
            role: 'assistant',
            content: `Request failed: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        isStreaming: false,
        abortController: null,
      }));
      await persistAssistantIfNeeded();
      return;
    }

    set({ isStreaming: false, abortController: null });
    await persistAssistantIfNeeded();
  },

  abortStream: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  clearMessages: () => set({ messages: [], hitlApprovals: [] }),
}));

export function buildPutAppPrefsPayload(
  apiKeysPatch?: Record<string, string>
): PutAppPrefsPayload {
  const s = useSettingsStore.getState();
  const c = useChatStore.getState();
  return {
    selectedProvider: s.selectedProvider,
    selectedModel: s.selectedModel,
    activeConversationId: c.activeConversationId,
    agentBackend: s.agentBackend,
    clineModel: s.clineModel,
    customBaseUrl: s.customBaseUrl,
    workspaceRoot: s.workspaceRoot,
    clineLocalBaseUrl: s.clineLocalBaseUrl,
    clineAgentId: s.clineAgentId,
    clineAutoFallbackOnError: s.clineAutoFallbackOnError,
    agentPanelOpen: s.agentPanelOpen,
    historyPanelOpen: s.historyPanelOpen,
    ...(apiKeysPatch ? { apiKeys: apiKeysPatch } : {}),
  };
}

async function flushPrefs(): Promise<void> {
  await persistenceApi.putPrefs(buildPutAppPrefsPayload());
}

/** Persist settings + optional API key patch (merge on server). */
export async function flushAppPrefsToServer(apiKeysPatch?: Record<string, string>): Promise<void> {
  await persistenceApi.putPrefs(buildPutAppPrefsPayload(apiKeysPatch));
}
