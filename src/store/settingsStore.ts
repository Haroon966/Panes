import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId } from '@/types/models';

type StoredKeys = Partial<Record<ProviderId, string>> & {
  customBaseUrl?: string;
};

function enc(s: string): string {
  if (!s) return '';
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return s;
  }
}

function dec(s: string): string {
  if (!s) return '';
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return s;
  }
}

interface SettingsState {
  apiKeys: StoredKeys;
  selectedProvider: ProviderId;
  selectedModel: string;
  agentMode: boolean;
  setApiKey: (provider: ProviderId, raw: string) => void;
  setCustomBaseUrl: (raw: string) => void;
  setSelected: (provider: ProviderId, modelId: string) => void;
  setAgentMode: (on: boolean) => void;
  getDecodedKey: (provider: ProviderId) => string;
  getCustomBaseUrl: () => string;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKeys: {},
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentMode: false,
      setApiKey: (provider, raw) =>
        set((s) => ({
          apiKeys: { ...s.apiKeys, [provider]: enc(raw) },
        })),
      setCustomBaseUrl: (raw) =>
        set((s) => ({
          apiKeys: { ...s.apiKeys, customBaseUrl: enc(raw) },
        })),
      setSelected: (provider, modelId) => set({ selectedProvider: provider, selectedModel: modelId }),
      setAgentMode: (on) => set({ agentMode: on }),
      getDecodedKey: (provider) => dec(get().apiKeys[provider] || ''),
      getCustomBaseUrl: () => dec(get().apiKeys.customBaseUrl || ''),
    }),
    { name: 'terminalai-settings-v1' }
  )
);
