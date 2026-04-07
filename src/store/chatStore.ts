import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat';
import * as persistenceApi from '@/lib/persistenceApi';
import type { ConversationRow, PutAppPrefsPayload } from '@/lib/persistenceApi';
import { fetchAgentStreamWithRetry } from '@/lib/agentStreamFetch';
import { createAgentStreamFeed, withDevAgentStreamTelemetry } from '@/lib/agentStreamProtocol';
import type {
  TerminalAiApprovalEvent,
  TerminalAiGraphPhaseEvent,
  TerminalAiToolDoneEvent,
  TerminalAiToolStartEvent,
  ToolActivityCategory,
} from '@/lib/agentStreamProtocol';
import { useSettingsStore } from './settingsStore';
import { useTerminalStore } from './terminalStore';
import { useWorkbenchStore } from './workbenchStore';

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

/** Server returns 400 with these when keys/base URL are missing (see server/routes/agent.ts). */
export function isClientConfigHttpError(status: number, detail: string): boolean {
  const d = detail.toLowerCase();
  if (status === 401) return true;
  if (status === 400) {
    return (
      d.includes('api key missing') ||
      d.includes('requires baseurl') ||
      d.includes('unknown provider') ||
      d.includes('custom provider requires') ||
      d.includes('invalid api key') ||
      d.includes('incorrect api key')
    );
  }
  return (
    d.includes('api key') &&
    (d.includes('invalid') || d.includes('missing') || d.includes('incorrect') || d.includes('unauthorized'))
  );
}

const MAX_WORKSPACE_SELECTION_INJECT_CHARS = 32_000;

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

/** Live LangGraph tool rows for the current turn (not persisted). */
export type AgentToolCallRow = {
  callId: string;
  toolName: string;
  phase: 'running' | 'awaiting_approval' | 'done' | 'error';
  preview?: string;
  error?: string;
  /** Server redacted likely secrets from preview/error (see stream `secretHint`). */
  secretHint?: string;
  /** Server-reported wall time for the tool call (ms), when present. */
  elapsedMs?: number;
  approvalId?: string;
  title?: string;
  subtitle?: string;
  category?: ToolActivityCategory;
};

const REWRITE_RESPONSE_DEFAULT_HINT =
  'Rewrite your previous assistant message: improve clarity, structure, and correctness while preserving the user’s intent and factual claims.';

type AgentPayloadMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function persistAssistantIfNeeded(): Promise<void> {
  const { messages, activeConversationId } = useChatStore.getState();
  const last = messages[messages.length - 1];
  if (!activeConversationId || last?.role !== 'assistant') return;
  try {
    try {
      await persistenceApi.patchMessage(activeConversationId, last.id, {
        content: last.content,
        alternates: last.alternates,
      });
    } catch {
      await persistenceApi.appendMessage(activeConversationId, {
        id: last.id,
        role: last.role,
        content: last.content,
        alternates: last.alternates,
      });
    }
    const list = await persistenceApi.listConversations();
    useChatStore.setState({ conversations: list });
  } catch (e) {
    console.warn('[TerminalAI] Failed to persist assistant message', e);
  }
}

/** Stream agent tokens; caller sets `isStreaming` / `abortController`. */
async function runAgentStream(
  get: () => ChatState,
  _set: (partial: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
  opts: {
    messagesPayload: AgentPayloadMessage[];
    regenerationHint?: string;
    /** `undefined` = use store `pendingErrorContext`; `null` = omit. */
    errorContext?: string | null;
    onVisible: (text: string) => void;
    onHttpErrorAssistant: (content: string, needsKeys: boolean) => void;
    onNetworkErrorAssistant: (content: string) => void;
    onClineConfigError: (content: string) => void;
  }
): Promise<'ok' | 'aborted' | 'error'> {
  const settings = useSettingsStore.getState();
  const errCtx = opts.errorContext === undefined ? get().pendingErrorContext : opts.errorContext;
  const terminalCtx = useTerminalStore.getState().getTerminalContext();
  const terminalSessionId = useTerminalStore.getState().getShellConnectedSessionId();

  const useCline = settings.agentBackend === 'cline';
  const clineUrlResolved = settings.getClineLocalBaseUrl().trim();
  const workspaceRootHint = settings.getWorkspaceRoot().trim();
  const clineLocalBody = settings.getClineLocalBaseUrl().trim();

  const dirtyPaths = useWorkbenchStore.getState().dirtyWorkspacePaths;
  const langchainPayload = {
    messages: opts.messagesPayload,
    provider: settings.selectedProvider,
    model: settings.selectedModel,
    errorContext: errCtx ?? undefined,
    terminalContext: terminalCtx || undefined,
    ...(terminalSessionId ? { terminalSessionId } : {}),
    ...(workspaceRootHint ? { workspaceRoot: workspaceRootHint } : {}),
    ...(opts.regenerationHint ? { regenerationHint: opts.regenerationHint } : {}),
    ...(dirtyPaths.length ? { workspaceDirtyPaths: dirtyPaths } : {}),
  };

  const clinePayload = {
    messages: opts.messagesPayload,
    model: settings.selectedModel,
    provider: settings.selectedProvider,
    clineAgentId: settings.clineAgentId,
    ...(settings.clineModel.trim() ? { clineModel: settings.clineModel.trim() } : {}),
    errorContext: errCtx ?? undefined,
    terminalContext: terminalCtx || undefined,
    ...(terminalSessionId ? { terminalSessionId } : {}),
    ...(workspaceRootHint ? { workspaceRoot: workspaceRootHint } : {}),
    ...(clineLocalBody ? { clineLocalBaseUrl: clineLocalBody } : {}),
    ...(opts.regenerationHint ? { regenerationHint: opts.regenerationHint } : {}),
    ...(dirtyPaths.length ? { workspaceDirtyPaths: dirtyPaths } : {}),
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
    opts.onClineConfigError(msg);
    return 'error';
  }

  const ac = get().abortController;
  if (!ac) return 'error';

  _set({
    agentStreamShellSessionId: terminalSessionId ?? null,
  });
  try {
    const res = await fetchAgentStreamWithRetry(endpoint, {
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
      const needsKeys = isClientConfigHttpError(res.status, detail);
      const assistantContent = needsKeys
        ? 'Model request failed: check your API key or provider settings (Manage API keys below).'
        : detail;
      opts.onHttpErrorAssistant(assistantContent, needsKeys);
      return 'error';
    }

    const reader = res.body?.getReader();
    if (!reader) {
      opts.onNetworkErrorAssistant('No response body from model.');
      return 'error';
    }

    const dec = new TextDecoder();
    const streamFeed = createAgentStreamFeed(
      withDevAgentStreamTelemetry({
        onVisible: opts.onVisible,
        onApproval: (ev) => get().pushHitlApproval(ev),
        onToolStart: (ev) => get().pushAgentToolStart(ev),
        onToolDone: (ev) => get().applyAgentToolDone(ev),
        onUsage: (ev) =>
          _set((s) => ({
            sessionTokenUsage: {
              input: s.sessionTokenUsage.input + ev.inputDelta,
              output: s.sessionTokenUsage.output + ev.outputDelta,
            },
          })),
        onGraphPhase: (ev) => get().applyAgentGraphPhase(ev),
      })
    );
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      streamFeed.push(chunk);
    }
    streamFeed.finish();
    return 'ok';
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return 'aborted';
    }
    opts.onNetworkErrorAssistant(
      `Request failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return 'error';
  } finally {
    _set({ agentStreamShellSessionId: null });
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
  /** Collapsible tool trace for the LangGraph stream (current session only). */
  activeToolCalls: AgentToolCallRow[];
  /**
   * Last coarse LangGraph phase from `graph_phase` stream events (TerminalAI agent only).
   * Cleared when the stream ends or a new run starts.
   */
  agentGraphPhase: {
    phase: 'model' | 'tool';
    detail?: string;
    langgraphNode?: string;
  } | null;
  /**
   * Terminal tab id the in-flight agent request uses for integrated shell (tab “agent” badge).
   * Cleared when the stream finishes.
   */
  agentStreamShellSessionId: string | null;
  /**
   * Cumulative LLM tokens reported by the TerminalAI agent stream (`usage` events).
   * Resets on New chat / Clear chat. Not updated for Cline backend or providers without usage metadata.
   */
  sessionTokenUsage: { input: number; output: number };
  pushAgentToolStart: (event: TerminalAiToolStartEvent) => void;
  applyAgentGraphPhase: (event: TerminalAiGraphPhaseEvent) => void;
  applyAgentToolDone: (event: TerminalAiToolDoneEvent) => void;
  /** After a normal stream end: drop completed tool rows; keep awaiting approval. */
  pruneAgentToolActivityAfterStream: () => void;
  markToolCallHitlResolved: (callId: string, preview: string) => void;
  /** After a send fails due to missing/invalid API key or provider config — show CTA in chat input. */
  showManageKeysCallout: boolean;
  setShowManageKeysCallout: (v: boolean) => void;
  /** Brief text for a polite screen-reader announcement (e.g. stream stopped). */
  a11yAnnouncement: string;
  setA11yAnnouncement: (v: string) => void;
  setInput: (v: string) => void;
  /** ⌘/Ctrl+K from workspace Monaco: replace input with file context + optional fenced selection (truncated if huge). */
  openAgentWithWorkspaceEditorSelection: (opts: {
    relativePath: string;
    selection: string | null;
    fenceLang: string;
  }) => void;
  /** Prepends a one-line “active file” hint for the agent (⌘/Ctrl+L). Skips if that path is already in the input. */
  injectWorkspaceEditorFileContext: (relativePath: string) => void;
  setErrorContext: (ctx: string | null) => void;
  requestFocusChat: () => void;
  appendAssistantChunk: (chunk: string) => void;
  /** Append streamed text to a specific assistant message (regenerate). */
  appendAssistantChunkForMessageId: (messageId: string, chunk: string) => void;
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
  clearMessages: () => Promise<void>;
  renameConversation: (convId: string, title: string) => Promise<void>;
  regenerateAssistantMessage: (messageId: string) => Promise<void>;
  rewriteAssistantMessage: (messageId: string, hint?: string) => Promise<void>;
  applyUserMessageRewrite: (messageId: string, newContent: string) => Promise<void>;
  setMessageAlternateVersion: (messageId: string, alternateId: string) => Promise<void>;
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
  activeToolCalls: [],
  agentGraphPhase: null,
  agentStreamShellSessionId: null,
  sessionTokenUsage: { input: 0, output: 0 },
  showManageKeysCallout: false,
  a11yAnnouncement: '',

  setShowManageKeysCallout: (v) => set({ showManageKeysCallout: v }),

  setA11yAnnouncement: (v) => set({ a11yAnnouncement: v }),

  setInput: (v) => set({ input: v }),

  openAgentWithWorkspaceEditorSelection: (opts) => {
    const p = opts.relativePath.trim().replace(/\\/g, '/');
    if (!p) return;
    let sel = opts.selection?.trim() ?? '';
    if (sel.length > MAX_WORKSPACE_SELECTION_INJECT_CHARS) {
      sel =
        sel.slice(0, MAX_WORKSPACE_SELECTION_INJECT_CHARS) +
        '\n\n…(selection truncated for chat input size)';
    }
    const tick = `\`${p}\``;
    const header = `Workspace editor (active file): ${tick}\n\n`;
    const langRaw = opts.fenceLang.trim();
    const lang =
      !langRaw || langRaw === 'plaintext' || langRaw === 'txt' ? 'text' : langRaw;
    const body = sel
      ? `${header}Selected code:\n\n\`\`\`${lang}\n${sel}\n\`\`\`\n\n`
      : `${header}What would you like to do with this file?\n\n`;
    set({ input: body });
  },

  injectWorkspaceEditorFileContext: (relativePath) => {
    const p = relativePath.trim().replace(/\\/g, '/');
    if (!p) return;
    const tick = `\`${p}\``;
    set((s) => {
      if (s.input.includes(tick)) return s;
      const block = `Workspace editor (active file): ${tick}\n\n`;
      const cur = s.input;
      return { input: cur.trim() ? `${block}${cur}` : block };
    });
  },

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

  appendAssistantChunkForMessageId: (messageId, chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      const i = msgs.findIndex((m) => m.id === messageId);
      if (i < 0) return s;
      const cur = msgs[i]!;
      msgs[i] = { ...cur, content: cur.content + chunk };
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
      const activeToolCalls = event.callId
        ? s.activeToolCalls.map((c) =>
            c.callId === event.callId ? { ...c, approvalId: event.approvalId } : c
          )
        : s.activeToolCalls;
      return { hitlApprovals: [...s.hitlApprovals, row], activeToolCalls };
    }),

  pushAgentToolStart: (event) =>
    set((s) => ({
      activeToolCalls: [
        ...s.activeToolCalls,
        {
          callId: event.callId,
          toolName: event.toolName,
          phase: 'running',
          title: event.title,
          subtitle: event.subtitle,
          category: event.category,
        },
      ],
    })),

  applyAgentGraphPhase: (event) =>
    set(() => ({
      agentGraphPhase: {
        phase: event.phase,
        ...(event.detail !== undefined ? { detail: event.detail } : {}),
        ...(event.langgraphNode !== undefined ? { langgraphNode: event.langgraphNode } : {}),
      },
    })),

  applyAgentToolDone: (event) =>
    set((s) => ({
      activeToolCalls: s.activeToolCalls.map((c) => {
        if (c.callId !== event.callId) return c;
        if (event.status === 'ok') {
          return {
            ...c,
            phase: 'done',
            preview: event.preview,
            error: undefined,
            secretHint: event.secretHint,
            elapsedMs: event.elapsedMs,
          };
        }
        if (event.status === 'error') {
          return {
            ...c,
            phase: 'error',
            error: event.error,
            preview: undefined,
            secretHint: event.secretHint,
            elapsedMs: event.elapsedMs,
          };
        }
        return {
          ...c,
          phase: 'awaiting_approval',
          secretHint: undefined,
          elapsedMs: event.elapsedMs,
        };
      }),
    })),

  pruneAgentToolActivityAfterStream: () =>
    set((s) => ({
      activeToolCalls: s.activeToolCalls.filter((c) => c.phase === 'awaiting_approval'),
    })),

  markToolCallHitlResolved: (callId, preview) =>
    set((s) => ({
      activeToolCalls: s.activeToolCalls.map((c) =>
        c.callId === callId ? { ...c, phase: 'done', preview, error: undefined } : c
      ),
    })),

  resolveHitlApproval: (approvalId, status, feedback) =>
    set((s) => ({
      hitlApprovals: s.hitlApprovals.map((a) =>
        a.approvalId === approvalId ? { ...a, status, feedback } : a
      ),
    })),

  clearHitlApprovals: () =>
    set({
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      agentStreamShellSessionId: null,
    }),

  setConversations: (rows) => set({ conversations: rows }),

  setActiveConversationId: (convId) => set({ activeConversationId: convId }),

  hydrateConversation: (convId, messages) =>
    set({
      activeConversationId: convId,
      messages,
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      agentStreamShellSessionId: null,
    }),

  newChat: async () => {
    set({
      messages: [],
      activeConversationId: null,
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      agentStreamShellSessionId: null,
      sessionTokenUsage: { input: 0, output: 0 },
      showManageKeysCallout: false,
    });
    try {
      await flushPrefs();
    } catch (e) {
      console.warn('[TerminalAI] newChat failed to sync prefs', e);
    }
  },

  selectConversation: async (convId) => {
    try {
      const msgs = await persistenceApi.fetchMessages(convId);
      set({
        activeConversationId: convId,
        messages: msgs,
        hitlApprovals: [],
        activeToolCalls: [],
        agentGraphPhase: null,
        agentStreamShellSessionId: null,
      });
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
      ...(wasActive
        ? {
            activeConversationId: null,
            messages: [],
            hitlApprovals: [],
            activeToolCalls: [],
            agentGraphPhase: null,
            agentStreamShellSessionId: null,
            sessionTokenUsage: { input: 0, output: 0 },
          }
        : {}),
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

    set({ showManageKeysCallout: false, a11yAnnouncement: '' });

    const userMsg: ChatMessage = { id: id(), role: 'user', content: raw };
    set((s) => ({
      messages: [...s.messages, userMsg],
      input: '',
      pendingErrorContext: null,
      isStreaming: true,
      activeToolCalls: [],
      agentGraphPhase: null,
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

    const outcome = await runAgentStream(get, set, {
      messagesPayload,
      onVisible: (text) => get().appendAssistantChunk(text),
      onClineConfigError: (msg) => {
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'assistant', content: msg }],
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onHttpErrorAssistant: (content, needsKeys) => {
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'assistant', content }],
          isStreaming: false,
          abortController: null,
          showManageKeysCallout: needsKeys,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onNetworkErrorAssistant: (content) => {
        set((s) => ({
          messages: [
            ...s.messages,
            { id: id(), role: 'assistant', content },
          ],
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
    });

    if (outcome === 'aborted') {
      set({
        isStreaming: false,
        abortController: null,
        activeToolCalls: [],
        agentGraphPhase: null,
      });
      return;
    }

    set({ isStreaming: false, abortController: null, agentGraphPhase: null });
    if (outcome === 'ok' || outcome === 'error') {
      get().pruneAgentToolActivityAfterStream();
      await persistAssistantIfNeeded();
    }
  },

  renameConversation: async (convId, title) => {
    try {
      await persistenceApi.patchConversation(convId, { title });
      set((s) => ({
        conversations: s.conversations.map((c) => (c.id === convId ? { ...c, title } : c)),
      }));
    } catch (e) {
      console.warn('[TerminalAI] renameConversation failed', e);
    }
  },

  regenerateAssistantMessage: async (messageId) => {
    if (get().isStreaming) return;
    const cid = get().activeConversationId;
    if (!cid) return;
    const messages = get().messages;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx]!.role !== 'assistant') return;

    const msg = messages[idx]!;
    const prefix = messages.slice(0, idx);
    const messagesPayload = prefix.map((m) => ({ role: m.role, content: m.content }));
    const oldContent = msg.content;
    const newAlternates = [
      ...(msg.alternates ?? []),
      { id: id(), content: oldContent, createdAt: Date.now() },
    ];

    try {
      await persistenceApi.patchMessage(cid, messageId, {
        content: '',
        alternates: newAlternates,
      });
    } catch (e) {
      console.warn('[TerminalAI] regenerateAssistantMessage: initial patch failed', e);
      return;
    }

    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: '', alternates: newAlternates } : m
      ),
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      showManageKeysCallout: false,
      a11yAnnouncement: '',
      isStreaming: true,
    }));

    const ac = new AbortController();
    set({ abortController: ac });

    const outcome = await runAgentStream(get, set, {
      messagesPayload,
      errorContext: null,
      onVisible: (text) => get().appendAssistantChunkForMessageId(messageId, text),
      onClineConfigError: (errMsg) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content: errMsg, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onHttpErrorAssistant: (content, needsKeys) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          showManageKeysCallout: needsKeys,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onNetworkErrorAssistant: (content) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
    });

    set({ isStreaming: false, abortController: null, agentGraphPhase: null });
    if (outcome === 'aborted') {
      set({ activeToolCalls: [] });
    } else if (outcome === 'ok' || outcome === 'error') {
      get().pruneAgentToolActivityAfterStream();
      await persistAssistantIfNeeded();
    }
  },

  rewriteAssistantMessage: async (messageId, hint) => {
    if (get().isStreaming) return;
    const h = (hint ?? '').trim() || REWRITE_RESPONSE_DEFAULT_HINT;
    const cid = get().activeConversationId;
    if (!cid) return;
    const messages = get().messages;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx]!.role !== 'assistant') return;

    const msg = messages[idx]!;
    const prefix = messages.slice(0, idx);
    const messagesPayload = prefix.map((m) => ({ role: m.role, content: m.content }));
    const oldContent = msg.content;
    const newAlternates = [
      ...(msg.alternates ?? []),
      { id: id(), content: oldContent, createdAt: Date.now() },
    ];

    try {
      await persistenceApi.patchMessage(cid, messageId, {
        content: '',
        alternates: newAlternates,
      });
    } catch (e) {
      console.warn('[TerminalAI] rewriteAssistantMessage: initial patch failed', e);
      return;
    }

    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content: '', alternates: newAlternates } : m
      ),
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      showManageKeysCallout: false,
      a11yAnnouncement: '',
      isStreaming: true,
    }));

    const ac = new AbortController();
    set({ abortController: ac });

    const outcome = await runAgentStream(get, set, {
      messagesPayload,
      errorContext: null,
      regenerationHint: h,
      onVisible: (text) => get().appendAssistantChunkForMessageId(messageId, text),
      onClineConfigError: (errMsg) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content: errMsg, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onHttpErrorAssistant: (content, needsKeys) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          showManageKeysCallout: needsKeys,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onNetworkErrorAssistant: (content) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, content, alternates: newAlternates } : m
          ),
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
    });

    set({ isStreaming: false, abortController: null, agentGraphPhase: null });
    if (outcome === 'aborted') {
      set({ activeToolCalls: [] });
    } else if (outcome === 'ok' || outcome === 'error') {
      get().pruneAgentToolActivityAfterStream();
      await persistAssistantIfNeeded();
    }
  },

  applyUserMessageRewrite: async (messageId, newContent) => {
    if (get().isStreaming) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;
    const cid = get().activeConversationId;
    if (!cid) return;
    const messages = get().messages;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx]!.role !== 'user') return;

    const msg = messages[idx]!;
    const oldContent = msg.content;
    const newAlternates = [
      ...(msg.alternates ?? []),
      { id: id(), content: oldContent, createdAt: Date.now() },
    ];

    try {
      await persistenceApi.deleteConversationMessagesAfter(cid, messageId);
      await persistenceApi.patchMessage(cid, messageId, {
        content: trimmed,
        alternates: newAlternates,
      });
    } catch (e) {
      console.warn('[TerminalAI] applyUserMessageRewrite failed', e);
      return;
    }

    const prefix = [...messages.slice(0, idx), { ...msg, content: trimmed, alternates: newAlternates }];

    set({
      messages: prefix,
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      showManageKeysCallout: false,
      a11yAnnouncement: '',
      isStreaming: true,
    });

    const ac = new AbortController();
    set({ abortController: ac });

    const messagesPayload = prefix.map((m) => ({ role: m.role, content: m.content }));

    const outcome = await runAgentStream(get, set, {
      messagesPayload,
      errorContext: null,
      onVisible: (text) => get().appendAssistantChunk(text),
      onClineConfigError: (errMsg) => {
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'assistant', content: errMsg }],
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onHttpErrorAssistant: (content, needsKeys) => {
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'assistant', content }],
          isStreaming: false,
          abortController: null,
          showManageKeysCallout: needsKeys,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
      onNetworkErrorAssistant: (content) => {
        set((s) => ({
          messages: [...s.messages, { id: id(), role: 'assistant', content }],
          isStreaming: false,
          abortController: null,
          activeToolCalls: [],
          agentGraphPhase: null,
        }));
      },
    });

    set({ isStreaming: false, abortController: null, agentGraphPhase: null });
    if (outcome === 'aborted') {
      set({ activeToolCalls: [] });
    } else if (outcome === 'ok' || outcome === 'error') {
      get().pruneAgentToolActivityAfterStream();
      await persistAssistantIfNeeded();
    }
  },

  setMessageAlternateVersion: async (messageId, alternateId) => {
    if (get().isStreaming) return;
    const cid = get().activeConversationId;
    if (!cid) return;
    try {
      await persistenceApi.patchMessage(cid, messageId, { activateAlternateId: alternateId });
      const msgs = await persistenceApi.fetchMessages(cid);
      set({ messages: msgs });
    } catch (e) {
      console.warn('[TerminalAI] setMessageAlternateVersion failed', e);
    }
  },

  abortStream: () => {
    get().abortController?.abort();
    set({
      isStreaming: false,
      abortController: null,
      activeToolCalls: [],
      agentGraphPhase: null,
      agentStreamShellSessionId: null,
      a11yAnnouncement: 'Generation stopped.',
    });
  },

  clearMessages: async () => {
    const cid = get().activeConversationId;
    if (cid) {
      try {
        await persistenceApi.clearConversationMessages(cid);
      } catch (e) {
        console.warn('[TerminalAI] clearMessages failed to clear DB', e);
      }
      await get().refreshConversations();
    }
    set({
      messages: [],
      hitlApprovals: [],
      activeToolCalls: [],
      agentGraphPhase: null,
      agentStreamShellSessionId: null,
      sessionTokenUsage: { input: 0, output: 0 },
      showManageKeysCallout: false,
    });
    try {
      await flushPrefs();
    } catch (e) {
      console.warn('[TerminalAI] clearMessages failed to sync prefs', e);
    }
  },
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
    colorScheme: s.colorScheme,
    codeFontSizePx: s.codeFontSizePx,
    agentVerbosity: s.agentVerbosity,
    agentContextHints: s.agentContextHints,
    agentAutoMode: s.agentAutoMode,
    agentPinnedPaths: s.agentPinnedPaths,
    workspaceFormatOnSave: s.workspaceFormatOnSave,
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
