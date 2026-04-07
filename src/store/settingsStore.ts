import { create } from 'zustand';
import type { PrefsAgentVerbosity } from '@/lib/persistenceApi';
import type { ProviderId } from '@/types/models';
import {
  clampCodeFontSizePx,
  CODE_FONT_SIZE_DEFAULT,
} from '@/lib/codeFontSize';
import {
  applyTerminalaiThemeDataset,
  type ColorSchemePreference,
  type EffectiveTerminalTheme,
  resolveEffectiveTerminalTheme,
} from '@/lib/terminalaiTheme';

export type KeyPresence = Record<ProviderId, boolean>;

const MAX_AGENT_PINNED_PATHS_UI = 8;

function normalizePinnedPath(p: string): string {
  return p.trim().replace(/\\/g, '/');
}

function pinnedPathsEqual(a: string, b: string): boolean {
  return normalizePinnedPath(a) === normalizePinnedPath(b);
}

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
  selectedProvider: ProviderId;
  selectedModel: string;
  /** One shell command for agent tool run_project_verify_command (e.g. npm test). */
  agentVerifyCommand: string;
  agentPanelOpen: boolean;
  historyPanelOpen: boolean;
  /** User preference; `system` follows OS dark/light. */
  colorScheme: ColorSchemePreference;
  /** Resolved UI theme for Monaco, xterm, and `data-terminalai-theme`. */
  effectiveTerminalTheme: EffectiveTerminalTheme;
  /** Shared font size (px) for workspace Monaco editor and xterm. */
  codeFontSizePx: number;
  /** Shapes agent system prompt (SQLite). */
  agentVerbosity: PrefsAgentVerbosity;
  /** Free-text stack / conventions appended to agent system prompt. */
  agentContextHints: string;
  /** false = always confirm writes/patches/shell in UI (SQLite `agent_mode`). */
  agentAutoMode: boolean;
  /** Pinned workspace paths always inlined into the agent prompt (SQLite JSON). */
  agentPinnedPaths: string[];
  /** Run Monaco format before manual save of the active workspace tab (SQLite). */
  workspaceFormatOnSave: boolean;
  setKeyPresence: (presence: KeyPresence) => void;
  setApiKeyLocal: (provider: ProviderId, hasKey: boolean) => void;
  setCustomBaseUrl: (raw: string) => void;
  setWorkspaceRoot: (raw: string) => void;
  setAgentVerifyCommand: (raw: string) => void;
  setAgentPanelOpen: (open: boolean) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  setColorScheme: (scheme: ColorSchemePreference) => void;
  /** Call when OS theme changes while `colorScheme === 'system'`. */
  refreshEffectiveThemeFromSystem: () => void;
  setCodeFontSizePx: (px: number) => void;
  setAgentVerbosity: (v: PrefsAgentVerbosity) => void;
  setAgentContextHints: (raw: string) => void;
  setAgentAutoMode: (auto: boolean) => void;
  toggleAgentPinnedPath: (workspaceRelativePath: string) => void;
  removeAgentPinnedPath: (workspaceRelativePath: string) => void;
  setWorkspaceFormatOnSave: (on: boolean) => void;
  setSelected: (provider: ProviderId, modelId: string) => void;
  getCustomBaseUrl: () => string;
  getWorkspaceRoot: () => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  keyPresence: defaultKeyPresence(),
  customBaseUrl: '',
  workspaceRoot: '',
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o',
  agentVerifyCommand: '',
  agentPanelOpen: true,
  historyPanelOpen: true,
  colorScheme: 'dark',
  effectiveTerminalTheme: 'dark',
  codeFontSizePx: CODE_FONT_SIZE_DEFAULT,
  agentVerbosity: 'detailed',
  agentContextHints: '',
  agentAutoMode: true,
  agentPinnedPaths: [],
  workspaceFormatOnSave: false,
  setKeyPresence: (presence) => set({ keyPresence: presence }),
  setApiKeyLocal: (provider, hasKey) =>
    set((s) => ({
      keyPresence: { ...s.keyPresence, [provider]: hasKey },
    })),
  setCustomBaseUrl: (raw) => set({ customBaseUrl: raw }),
  setWorkspaceRoot: (raw) => set({ workspaceRoot: raw }),
  setAgentVerifyCommand: (raw) => set({ agentVerifyCommand: raw }),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),
  setColorScheme: (colorScheme) => {
    const effectiveTerminalTheme = resolveEffectiveTerminalTheme(colorScheme);
    applyTerminalaiThemeDataset(effectiveTerminalTheme);
    set({ colorScheme, effectiveTerminalTheme });
  },
  refreshEffectiveThemeFromSystem: () => {
    const { colorScheme } = get();
    if (colorScheme !== 'system') return;
    const effectiveTerminalTheme = resolveEffectiveTerminalTheme('system');
    applyTerminalaiThemeDataset(effectiveTerminalTheme);
    set({ effectiveTerminalTheme });
  },
  setCodeFontSizePx: (px) => set({ codeFontSizePx: clampCodeFontSizePx(px) }),
  setAgentVerbosity: (v) => set({ agentVerbosity: v }),
  setAgentContextHints: (raw) =>
    set(() => {
      const t = raw.replace(/\r\n/g, '\n');
      return { agentContextHints: t.length > 4000 ? t.slice(0, 4000) : t };
    }),
  setAgentAutoMode: (auto) => set({ agentAutoMode: auto }),
  toggleAgentPinnedPath: (workspaceRelativePath) =>
    set((s) => {
      const p = normalizePinnedPath(workspaceRelativePath);
      if (!p) return s;
      const has = s.agentPinnedPaths.some((x) => pinnedPathsEqual(x, p));
      if (has) {
        return {
          agentPinnedPaths: s.agentPinnedPaths.filter((x) => !pinnedPathsEqual(x, p)),
        };
      }
      if (s.agentPinnedPaths.length >= MAX_AGENT_PINNED_PATHS_UI) return s;
      return { agentPinnedPaths: [...s.agentPinnedPaths, p] };
    }),
  removeAgentPinnedPath: (workspaceRelativePath) =>
    set((s) => {
      const p = normalizePinnedPath(workspaceRelativePath);
      if (!p) return s;
      return {
        agentPinnedPaths: s.agentPinnedPaths.filter((x) => !pinnedPathsEqual(x, p)),
      };
    }),
  setWorkspaceFormatOnSave: (on) => set({ workspaceFormatOnSave: on }),
  setSelected: (provider, modelId) => set({ selectedProvider: provider, selectedModel: modelId }),
  getCustomBaseUrl: () => get().customBaseUrl,
  getWorkspaceRoot: () => get().workspaceRoot,
}));
