import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as persistenceApi from '@/lib/persistenceApi';
import type { AppPrefsResponse, PrefsAgentVerbosity } from '@/lib/persistenceApi';
import { terminalPersistedStateSchema } from '@/lib/terminalStateSchema';
import { clampCodeFontSizePx, CODE_FONT_SIZE_DEFAULT } from '@/lib/codeFontSize';
import { applyTerminalaiThemeDataset, resolveEffectiveTerminalTheme } from '@/lib/terminalaiTheme';
import { buildPutAppPrefsPayload, useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTerminalStore } from '@/store/terminalStore';

const LEGACY_STORAGE_KEY = 'terminalai-settings-v1';

function legacyDec(s: string): string {
  if (!s) return '';
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return s;
  }
}

const FALLBACK_KEY_PRESENCE: AppPrefsResponse['keyPresence'] = {
  openai: false,
  anthropic: false,
  google: false,
  groq: false,
  mistral: false,
  ollama: false,
  lmstudio: false,
  custom: false,
};

function normalizePrefsAgentVerbosity(v: unknown): PrefsAgentVerbosity {
  return v === 'concise' || v === 'detailed' || v === 'step_by_step' ? v : 'detailed';
}

function hydrateSettingsFromPrefs(p: AppPrefsResponse): void {
  const cs = p.colorScheme;
  const colorScheme = cs === 'light' || cs === 'system' ? cs : 'dark';
  const effectiveTerminalTheme = resolveEffectiveTerminalTheme(colorScheme);
  applyTerminalaiThemeDataset(effectiveTerminalTheme);
  const codeFontSizePx =
    typeof p.codeFontSizePx === 'number'
      ? clampCodeFontSizePx(p.codeFontSizePx)
      : CODE_FONT_SIZE_DEFAULT;
  const agentVerbosity = normalizePrefsAgentVerbosity(p.agentVerbosity);
  const hintsRaw = typeof p.agentContextHints === 'string' ? p.agentContextHints : '';
  const agentContextHints =
    hintsRaw.replace(/\r\n/g, '\n').length > 4000
      ? hintsRaw.replace(/\r\n/g, '\n').slice(0, 4000)
      : hintsRaw.replace(/\r\n/g, '\n');
  const agentAutoMode = p.agentAutoMode !== false;
  const agentPinnedPaths = Array.isArray(p.agentPinnedPaths) ? p.agentPinnedPaths : [];
  const workspaceFormatOnSave = p.workspaceFormatOnSave === true;
  useSettingsStore.setState({
    selectedProvider: p.selectedProvider,
    selectedModel: p.selectedModel,
    keyPresence: p.keyPresence ?? FALLBACK_KEY_PRESENCE,
    customBaseUrl: p.customBaseUrl ?? '',
    workspaceRoot: p.workspaceRoot ?? '',
    agentVerifyCommand: typeof p.agentVerifyCommand === 'string' ? p.agentVerifyCommand : '',
    agentPanelOpen: p.agentPanelOpen ?? true,
    historyPanelOpen: p.historyPanelOpen ?? true,
    colorScheme,
    effectiveTerminalTheme,
    codeFontSizePx,
    agentVerbosity,
    agentContextHints,
    agentAutoMode,
    agentPinnedPaths,
    workspaceFormatOnSave,
  });
}

/** Import secrets from pre-DB zustand persist (localStorage) once. */
async function migrateLegacyTerminalAiSettings(prefs: AppPrefsResponse): Promise<boolean> {
  const presence = prefs.keyPresence;
  if (presence && Object.values(presence).some((v) => v)) return false;

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as {
      state?: {
        apiKeys?: Record<string, string | undefined>;
        agentPanelOpen?: boolean;
        historyPanelOpen?: boolean;
      };
    };
    const st = parsed.state;
    if (!st?.apiKeys) return false;

    const ak = st.apiKeys;
    const apiKeys: Record<string, string> = {};
    for (const id of [
      'openai',
      'anthropic',
      'google',
      'groq',
      'mistral',
      'custom',
      'ollama',
      'lmstudio',
    ] as const) {
      const enc = ak[id];
      if (typeof enc === 'string') {
        const v = legacyDec(enc).trim();
        if (v) apiKeys[id] = v;
      }
    }

    if (
      Object.keys(apiKeys).length === 0 &&
      !legacyDec(ak.customBaseUrl || '').trim() &&
      !legacyDec(ak.workspaceRoot || '').trim()
    ) {
      return false;
    }

    await persistenceApi.putPrefs({
      selectedProvider: prefs.selectedProvider,
      selectedModel: prefs.selectedModel,
      activeConversationId: prefs.activeConversationId,
      customBaseUrl: legacyDec(ak.customBaseUrl || ''),
      workspaceRoot: legacyDec(ak.workspaceRoot || ''),
      agentVerifyCommand: prefs.agentVerifyCommand ?? '',
      agentPanelOpen: st.agentPanelOpen ?? prefs.agentPanelOpen ?? true,
      historyPanelOpen: st.historyPanelOpen ?? prefs.historyPanelOpen ?? true,
      colorScheme: prefs.colorScheme ?? 'dark',
      codeFontSizePx:
        typeof prefs.codeFontSizePx === 'number'
          ? clampCodeFontSizePx(prefs.codeFontSizePx)
          : CODE_FONT_SIZE_DEFAULT,
      agentVerbosity: normalizePrefsAgentVerbosity(prefs.agentVerbosity),
      agentContextHints:
        typeof prefs.agentContextHints === 'string'
          ? prefs.agentContextHints.replace(/\r\n/g, '\n').slice(0, 4000)
          : '',
      agentAutoMode: prefs.agentAutoMode !== false,
      agentPinnedPaths: Array.isArray(prefs.agentPinnedPaths) ? prefs.agentPinnedPaths : [],
      workspaceFormatOnSave: prefs.workspaceFormatOnSave === true,
      ...(Object.keys(apiKeys).length > 0 ? { apiKeys } : {}),
    });

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function prefsSyncSnapshot(
  s: ReturnType<typeof useSettingsStore.getState>,
  activeConversationId: string | null
): string {
  return JSON.stringify({
    selectedProvider: s.selectedProvider,
    selectedModel: s.selectedModel,
    customBaseUrl: s.customBaseUrl,
    workspaceRoot: s.workspaceRoot,
    agentVerifyCommand: s.agentVerifyCommand,
    agentPanelOpen: s.agentPanelOpen,
    historyPanelOpen: s.historyPanelOpen,
    colorScheme: s.colorScheme,
    codeFontSizePx: s.codeFontSizePx,
    agentVerbosity: s.agentVerbosity,
    agentContextHints: s.agentContextHints,
    agentAutoMode: s.agentAutoMode,
    agentPinnedPaths: s.agentPinnedPaths,
    workspaceFormatOnSave: s.workspaceFormatOnSave,
    activeConversationId,
  });
}

export function PersistenceProvider({ children }: { children: ReactNode }) {
  const [persistenceOk, setPersistenceOk] = useState<boolean | null>(null);
  const hydrated = useRef(false);
  const skipTerminalSave = useRef(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const health = await persistenceApi.getHealth();
        if (cancelled) return;
        setPersistenceOk(health.db !== false);
      } catch {
        if (!cancelled) setPersistenceOk(false);
      }

      let serverPrefs: AppPrefsResponse | null = null;
      try {
        serverPrefs = await persistenceApi.getPrefs();
        if (cancelled) return;

        const migrated = await migrateLegacyTerminalAiSettings(serverPrefs);
        if (migrated && !cancelled) {
          serverPrefs = await persistenceApi.getPrefs();
        }
        if (cancelled || !serverPrefs) return;

        hydrateSettingsFromPrefs(serverPrefs);
      } catch {
        /* offline */
      }

      try {
        const raw = await persistenceApi.getTerminalStatePayload();
        if (cancelled) return;
        const parsed = terminalPersistedStateSchema.safeParse(raw);
        if (parsed.success) {
          useTerminalStore.getState().hydrateFromPersisted(parsed.data);
        }
      } catch {
        /* offline */
      }

      try {
        const list = await persistenceApi.listConversations();
        if (cancelled) return;
        useChatStore.getState().setConversations(list);

        let targetId = serverPrefs?.activeConversationId ?? null;
        if (targetId && !list.some((c) => c.id === targetId)) {
          targetId = null;
        }
        if (!targetId && list.length > 0) {
          targetId = list[0].id;
        }

        if (targetId) {
          const msgs = await persistenceApi.fetchMessages(targetId);
          if (cancelled) return;
          if (msgs.length === 0) {
            useChatStore.getState().hydrateConversation(null, []);
            try {
              await persistenceApi.putPrefs(buildPutAppPrefsPayload());
            } catch {
              /* offline */
            }
          } else {
            useChatStore.getState().hydrateConversation(targetId, msgs);
          }
        }
      } catch {
        /* offline */
      }

      hydrated.current = true;
      queueMicrotask(() => {
        skipTerminalSave.current = false;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const schedulePrefs = debounce(() => {
      if (!hydrated.current) return;
      persistenceApi.putPrefs(buildPutAppPrefsPayload()).catch(() => {
        setPersistenceOk(false);
      });
    }, 450);

    let lastSnap = prefsSyncSnapshot(
      useSettingsStore.getState(),
      useChatStore.getState().activeConversationId
    );

    const unsubSettings = useSettingsStore.subscribe((state) => {
      const snap = prefsSyncSnapshot(state, useChatStore.getState().activeConversationId);
      if (snap !== lastSnap) {
        lastSnap = snap;
        schedulePrefs();
      }
    });

    const unsubChat = useChatStore.subscribe((state) => {
      const snap = prefsSyncSnapshot(useSettingsStore.getState(), state.activeConversationId);
      if (snap !== lastSnap) {
        lastSnap = snap;
        schedulePrefs();
      }
    });

    return () => {
      unsubSettings();
      unsubChat();
    };
  }, []);

  useEffect(() => {
    const scheduleTerminal = debounce(() => {
      if (!hydrated.current || skipTerminalSave.current) return;
      const snap = useTerminalStore.getState().getPersistedSnapshot();
      persistenceApi.putTerminalStatePayload(snap).catch(() => {
        setPersistenceOk(false);
      });
    }, 400);

    let lastSerialized = JSON.stringify(useTerminalStore.getState().getPersistedSnapshot());

    const unsub = useTerminalStore.subscribe((state) => {
      const serialized = JSON.stringify(state.getPersistedSnapshot());
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        scheduleTerminal();
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onOsTheme = () => {
      useSettingsStore.getState().refreshEffectiveThemeFromSystem();
    };
    mq.addEventListener('change', onOsTheme);
    return () => mq.removeEventListener('change', onOsTheme);
  }, []);

  return (
    <>
      {persistenceOk === false && (
        <div
          className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2 rounded-b-md border border-amber-600/50 bg-amber-950/90 px-3 py-1 text-center text-xs text-amber-100"
          role="status"
        >
          Persistence offline — chat and layout won&apos;t save until the API server is reachable.
        </div>
      )}
      {children}
    </>
  );
}
