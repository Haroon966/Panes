import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat';
import { useSettingsStore } from './settingsStore';
import { useTerminalStore } from './terminalStore';

function id(): string {
  return crypto.randomUUID();
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  pendingErrorContext: string | null;
  focusChatNonce: number;
  abortController: AbortController | null;
  setInput: (v: string) => void;
  setErrorContext: (ctx: string | null) => void;
  requestFocusChat: () => void;
  appendAssistantChunk: (chunk: string) => void;
  sendMessage: () => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  input: '',
  isStreaming: false,
  pendingErrorContext: null,
  focusChatNonce: 0,
  abortController: null,

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

  sendMessage: async () => {
    const raw = get().input.trim();
    if (!raw || get().isStreaming) return;

    const settings = useSettingsStore.getState();
    const errCtx = get().pendingErrorContext;
    const terminalCtx = useTerminalStore.getState().getTerminalContext();

    const userMsg: ChatMessage = { id: id(), role: 'user', content: raw };
    set((s) => ({
      messages: [...s.messages, userMsg],
      input: '',
      pendingErrorContext: null,
      isStreaming: true,
    }));

    const ac = new AbortController();
    set({ abortController: ac });

    const endpoint = settings.agentMode ? '/api/agent' : '/api/chat';

    const messagesPayload = get().messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const common = {
      messages: messagesPayload,
      provider: settings.selectedProvider,
      model: settings.selectedModel,
      apiKey: settings.getDecodedKey(settings.selectedProvider),
      baseUrl:
        settings.selectedProvider === 'custom' ? settings.getCustomBaseUrl() : undefined,
      errorContext: errCtx ?? undefined,
      terminalContext: terminalCtx || undefined,
    };

    const payload =
      endpoint === '/api/agent'
        ? common
        : { ...common, agentMode: settings.agentMode };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        set((s) => ({
          messages: [
            ...s.messages,
            { id: id(), role: 'assistant', content: `Error: ${res.status} ${errText}` },
          ],
          isStreaming: false,
          abortController: null,
        }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        set({ isStreaming: false, abortController: null });
        return;
      }

      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        get().appendAssistantChunk(chunk);
      }
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
      return;
    }

    set({ isStreaming: false, abortController: null });
  },

  abortStream: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  clearMessages: () => set({ messages: [] }),
}));
