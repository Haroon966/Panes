import { create } from 'zustand';
import type { ProviderId } from '@/types/models';

export type AgentBackend = 'langchain' | 'cline';

export type KeyPresence = Record<ProviderId, boolean>;

function defaultKeyPresence(): KeyPresence {
  return {
    openai: false,
    anthropic: false,
    google: false,
    groq: false,
    mistral: false,
    ollama: false,
    lmstudio: false,
    custom: false,
  };
}

interface SettingsState {
  keyPresence: KeyPresence;
  customBaseUrl: string;
  workspaceRoot: string;
  clineLocalBaseUrl: string;
  selectedProvider: ProviderId;
  selectedModel: string;
  agentBackend: AgentBackend;
  clineAgentId: string;
  clineModel: string;
  clineAutoFallbackOnError: boolean;
  /** From GET /api/agent/cline/options; not persisted. */
  clineServerBaseConfigured: boolean | null;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
  setKeyPresence: (presence: KeyPresence) => void;
  setApiKeyLocal: (provider: ProviderId, hasKey: boolean) => void;
  setCustomBaseUrl: (raw: string) => void;
  setWorkspaceRoot: (raw: string) => void;
  setClineLocalBaseUrl: (raw: string) => void;
  setAgentBackend: (b: AgentBackend) => void;
  setClineAgentId: (id: string) => void;
  setClineModel: (m: string) => void;
  setClineAutoFallbackOnError: (v: boolean) => void;
  setClineServerBaseConfigured: (v: boolean | null) => void;
  setAgentPanelOpen: (open: boolean) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  setSelected: (provider: ProviderId, modelId: string) => void;
  getCustomBaseUrl: () => string;
  getWorkspaceRoot: () => string;
  getClineLocalBaseUrl: () => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  keyPresence: defaultKeyPresence(),
  customBaseUrl: '',
  workspaceRoot: '',
  clineLocalBaseUrl: '',
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o',
  agentBackend: 'cline',
  clineAgentId: 'default',
  clineModel: '',
  clineAutoFallbackOnError: true,
  clineServerBaseConfigured: null,
  agentPanelOpen: true,
  historyPanelOpen: true,
  setKeyPresence: (presence) => set({ keyPresence: presence }),
  setApiKeyLocal: (provider, hasKey) =>
    set((s) => ({
      keyPresence: { ...s.keyPresence, [provider]: hasKey },
    })),
  setCustomBaseUrl: (raw) => set({ customBaseUrl: raw }),
  setWorkspaceRoot: (raw) => set({ workspaceRoot: raw }),
  setClineLocalBaseUrl: (raw) => set({ clineLocalBaseUrl: raw }),
  setAgentBackend: (b) => set({ agentBackend: b }),
  setClineAgentId: (id) => set({ clineAgentId: id }),
  setClineModel: (m) => set({ clineModel: m }),
  setClineAutoFallbackOnError: (v) => set({ clineAutoFallbackOnError: v }),
  setClineServerBaseConfigured: (v) => set({ clineServerBaseConfigured: v }),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),
  setSelected: (provider, modelId) => set({ selectedProvider: provider, selectedModel: modelId }),
  getCustomBaseUrl: () => get().customBaseUrl,
  getWorkspaceRoot: () => get().workspaceRoot,
  getClineLocalBaseUrl: () => get().clineLocalBaseUrl,
}));
