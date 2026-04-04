import { create } from 'zustand';
import type { TerminalPersistedState } from '@/lib/terminalStateSchema';
import {
  computeStatusFromLogicalTail,
  computeStatusFromOutputLine,
  snapshotDisconnected,
  snapshotErrorFromExitCode,
  snapshotForUserCommand,
  snapshotReady,
  snapshotSuccess,
  type TerminalStatusKind,
  type TerminalStatusSnapshot,
} from '@/utils/terminalSessionStatus';

export type SessionId = string;

const MIN_RUNNING_MS = 300;

const successClearTimers = new Map<SessionId, number>();
const minDwellTimers = new Map<SessionId, number>();

function clearSuccessClearTimer(id: SessionId): void {
  const t = successClearTimers.get(id);
  if (t !== undefined) {
    window.clearTimeout(t);
    successClearTimers.delete(id);
  }
}

function clearMinDwellTimer(id: SessionId): void {
  const t = minDwellTimers.get(id);
  if (t !== undefined) {
    window.clearTimeout(t);
    minDwellTimers.delete(id);
  }
}

function scheduleSuccessToReady(id: SessionId): void {
  clearSuccessClearTimer(id);
  const t = window.setTimeout(() => {
    successClearTimers.delete(id);
    useTerminalStore.setState((s) => {
      const cur = s.terminalSessionStatuses[id];
      if (cur?.kind !== 'success') return s;
      return {
        terminalSessionStatuses: {
          ...s.terminalSessionStatuses,
          [id]: snapshotReady(),
        },
      };
    });
  }, 2600);
  successClearTimers.set(id, t);
}

export interface TerminalController {
  write: (data: string) => void;
  pasteAndRun: (cmd: string) => void;
  clear: () => void;
  resize: () => void;
}

export type TerminalLayout =
  | { mode: 'tabs' }
  | { mode: 'split-h'; left: SessionId; right: SessionId }
  | { mode: 'split-v'; top: SessionId; bottom: SessionId };

const MAX_LINES = 500;

function newId(): string {
  return crypto.randomUUID();
}

interface TerminalState {
  sessions: { id: SessionId; title: string }[];
  activeSessionId: SessionId;
  focusedSessionId: SessionId;
  layout: TerminalLayout;
  controllers: Partial<Record<SessionId, TerminalController>>;
  outputLines: string[];
  terminalSessionStatuses: Partial<Record<SessionId, TerminalStatusSnapshot>>;
  /** After first applied exit OSC for a session, prompt/error heuristics no longer drive success/failure while Running. */
  terminalSessionExitOscEnabled: Partial<Record<SessionId, boolean>>;

  addSession: (title?: string) => SessionId;
  removeSession: (id: SessionId) => void;
  setActive: (id: SessionId) => void;
  setFocused: (id: SessionId) => void;
  renameSession: (id: SessionId, title: string) => void;
  registerController: (id: SessionId, c: TerminalController) => void;
  unregisterController: (id: SessionId) => void;
  appendOutputLine: (line: string) => void;
  clearOutputBuffer: () => void;
  pasteAndRun: (cmd: string) => void;
  /** User submitted a non-empty command (Enter or pasteAndRun). */
  reportUserSubmittedNonEmptyCommand: (id: SessionId) => void;
  /** Printable input while Success or Error — return to Ready. */
  reportUserTyping: (id: SessionId) => void;
  /** Parsed from PTY stream; only affects state if currently Running. */
  reportShellExitCode: (id: SessionId, code: number) => void;
  reportTerminalOutputLine: (id: SessionId, line: string) => void;
  reportTerminalLogicalTail: (id: SessionId, outBuf: string) => void;
  reportTerminalDisconnected: (id: SessionId) => void;
  splitHorizontal: () => void;
  splitVertical: () => void;
  closeSplit: () => void;
  getTerminalContext: () => string;
  getShellConnectedSessionId: () => SessionId | undefined;
  hydrateFromPersisted: (payload: TerminalPersistedState) => void;
  getPersistedSnapshot: () => TerminalPersistedState;
}

const firstId = newId();

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [{ id: firstId, title: 'Terminal 1' }],
  activeSessionId: firstId,
  focusedSessionId: firstId,
  layout: { mode: 'tabs' },
  controllers: {},
  outputLines: [],
  terminalSessionStatuses: { [firstId]: snapshotReady() },
  terminalSessionExitOscEnabled: { [firstId]: false },

  addSession: (title) => {
    const sid = newId();
    set((s) => ({
      sessions: [...s.sessions, { id: sid, title: title ?? `Terminal ${s.sessions.length + 1}` }],
      activeSessionId: sid,
      focusedSessionId: sid,
      layout: { mode: 'tabs' },
      terminalSessionStatuses: {
        ...s.terminalSessionStatuses,
        [sid]: snapshotReady(),
      },
      terminalSessionExitOscEnabled: {
        ...s.terminalSessionExitOscEnabled,
        [sid]: false,
      },
    }));
    return sid;
  },

  removeSession: (id) => {
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      clearSuccessClearTimer(id);
      clearMinDwellTimer(id);
      if (sessions.length === 0) {
        const nid = newId();
        return {
          sessions: [{ id: nid, title: 'Terminal 1' }],
          activeSessionId: nid,
          focusedSessionId: nid,
          layout: { mode: 'tabs' },
          terminalSessionStatuses: { [nid]: snapshotReady() },
          terminalSessionExitOscEnabled: {},
        };
      }
      let layout = s.layout;
      if (layout.mode === 'split-h' && (layout.left === id || layout.right === id)) {
        layout = { mode: 'tabs' };
      }
      if (layout.mode === 'split-v' && (layout.top === id || layout.bottom === id)) {
        layout = { mode: 'tabs' };
      }
      const active =
        s.activeSessionId === id ? (sessions[0]?.id ?? s.activeSessionId) : s.activeSessionId;
      const focused =
        s.focusedSessionId === id ? (sessions[0]?.id ?? active) : s.focusedSessionId;
      const terminalSessionStatuses = { ...s.terminalSessionStatuses };
      delete terminalSessionStatuses[id];
      const terminalSessionExitOscEnabled = { ...s.terminalSessionExitOscEnabled };
      delete terminalSessionExitOscEnabled[id];
      return {
        sessions,
        activeSessionId: active,
        focusedSessionId: focused,
        layout,
        terminalSessionStatuses,
        terminalSessionExitOscEnabled,
      };
    });
  },

  setActive: (id) => set({ activeSessionId: id, focusedSessionId: id }),
  setFocused: (id) => set({ focusedSessionId: id }),

  renameSession: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)),
    })),

  registerController: (id, c) => {
    set((s) => {
      const cur = s.terminalSessionStatuses[id];
      const preserve: TerminalStatusKind[] = ['running', 'interactive', 'error', 'success'];
      const nextStatus =
        cur && preserve.includes(cur.kind) ? cur : snapshotReady();
      if (nextStatus.kind !== 'success') {
        clearSuccessClearTimer(id);
      }
      return {
        controllers: { ...s.controllers, [id]: c },
        terminalSessionStatuses: {
          ...s.terminalSessionStatuses,
          [id]: nextStatus,
        },
      };
    });
  },

  unregisterController: (id) => {
    clearSuccessClearTimer(id);
    clearMinDwellTimer(id);
    set((s) => {
      const next = { ...s.controllers };
      delete next[id];
      return {
        controllers: next,
        terminalSessionStatuses: {
          ...s.terminalSessionStatuses,
          [id]: snapshotDisconnected(),
        },
      };
    });
  },

  appendOutputLine: (line) =>
    set((s) => ({
      outputLines: [...s.outputLines, line].slice(-MAX_LINES),
    })),

  clearOutputBuffer: () => set({ outputLines: [] }),

  pasteAndRun: (cmd) => {
    const { focusedSessionId, activeSessionId, controllers } = get();
    const sid = focusedSessionId || activeSessionId;
    const c = controllers[sid];
    if (!c) return;
    const oneLine = cmd.replace(/\r?\n/g, ' ').trim();
    if (!oneLine) return;
    get().reportUserSubmittedNonEmptyCommand(sid);
    c.pasteAndRun(oneLine);
  },

  reportUserSubmittedNonEmptyCommand: (id) => {
    clearSuccessClearTimer(id);
    clearMinDwellTimer(id);
    set((s) => ({
      terminalSessionStatuses: {
        ...s.terminalSessionStatuses,
        [id]: snapshotForUserCommand(),
      },
    }));
  },

  reportUserTyping: (id) => {
    const cur = get().terminalSessionStatuses[id];
    if (cur?.kind !== 'success' && cur?.kind !== 'error') return;
    clearSuccessClearTimer(id);
    set((s) => ({
      terminalSessionStatuses: {
        ...s.terminalSessionStatuses,
        [id]: snapshotReady(),
      },
    }));
  },

  reportShellExitCode: (id, code) => {
    const prev = get().terminalSessionStatuses[id] ?? snapshotReady();
    if (prev.kind !== 'running') return;

    set((s) => ({
      terminalSessionExitOscEnabled: { ...s.terminalSessionExitOscEnabled, [id]: true },
    }));

    clearSuccessClearTimer(id);
    clearMinDwellTimer(id);
    const started = prev.runningStartedAtMs ?? Date.now();
    const elapsed = Date.now() - started;
    const delay = Math.max(0, MIN_RUNNING_MS - elapsed);

    const apply = () => {
      minDwellTimers.delete(id);
      const now = get().terminalSessionStatuses[id];
      if (now?.kind !== 'running') return;
      if (code === 0) {
        clearSuccessClearTimer(id);
        set((s) => ({
          terminalSessionStatuses: {
            ...s.terminalSessionStatuses,
            [id]: snapshotSuccess(),
          },
        }));
        scheduleSuccessToReady(id);
      } else {
        clearSuccessClearTimer(id);
        set((s) => ({
          terminalSessionStatuses: {
            ...s.terminalSessionStatuses,
            [id]: snapshotErrorFromExitCode(code),
          },
        }));
      }
    };

    if (delay <= 0) apply();
    else minDwellTimers.set(id, window.setTimeout(apply, delay));
  },

  reportTerminalOutputLine: (id, line) => {
    const exitOsc = get().terminalSessionExitOscEnabled[id] ?? false;
    const prev = get().terminalSessionStatuses[id] ?? snapshotReady();
    const next = computeStatusFromOutputLine(line, prev, { exitOscPrimary: exitOsc });
    if (!next) return;
    if (next.kind === prev.kind && next.label === prev.label) return;
    if (next.kind === 'success') {
      clearSuccessClearTimer(id);
      scheduleSuccessToReady(id);
    } else {
      clearSuccessClearTimer(id);
    }
    set((s) => ({
      terminalSessionStatuses: { ...s.terminalSessionStatuses, [id]: next },
    }));
  },

  reportTerminalLogicalTail: (id, outBuf) => {
    const exitOsc = get().terminalSessionExitOscEnabled[id] ?? false;
    const prev = get().terminalSessionStatuses[id] ?? snapshotReady();
    const next = computeStatusFromLogicalTail(outBuf, prev, { exitOscPrimary: exitOsc });
    if (!next) return;
    if (next.kind === prev.kind && next.label === prev.label) return;
    if (next.kind === 'success') {
      clearSuccessClearTimer(id);
      scheduleSuccessToReady(id);
    } else {
      clearSuccessClearTimer(id);
    }
    set((s) => ({
      terminalSessionStatuses: { ...s.terminalSessionStatuses, [id]: next },
    }));
  },

  reportTerminalDisconnected: (id) => {
    clearSuccessClearTimer(id);
    clearMinDwellTimer(id);
    set((s) => ({
      terminalSessionStatuses: {
        ...s.terminalSessionStatuses,
        [id]: snapshotDisconnected(),
      },
    }));
  },

  splitHorizontal: () => {
    const { activeSessionId, sessions, terminalSessionStatuses, terminalSessionExitOscEnabled } = get();
    const right = newId();
    set({
      sessions: [...sessions, { id: right, title: `Terminal ${sessions.length + 1}` }],
      layout: { mode: 'split-h', left: activeSessionId, right },
      activeSessionId: right,
      focusedSessionId: right,
      terminalSessionStatuses: {
        ...terminalSessionStatuses,
        [right]: snapshotReady(),
      },
      terminalSessionExitOscEnabled: {
        ...terminalSessionExitOscEnabled,
        [right]: false,
      },
    });
  },

  splitVertical: () => {
    const { activeSessionId, sessions, terminalSessionStatuses, terminalSessionExitOscEnabled } = get();
    const bottom = newId();
    set({
      sessions: [...sessions, { id: bottom, title: `Terminal ${sessions.length + 1}` }],
      layout: { mode: 'split-v', top: activeSessionId, bottom },
      activeSessionId: bottom,
      focusedSessionId: bottom,
      terminalSessionStatuses: {
        ...terminalSessionStatuses,
        [bottom]: snapshotReady(),
      },
      terminalSessionExitOscEnabled: {
        ...terminalSessionExitOscEnabled,
        [bottom]: false,
      },
    });
  },

  closeSplit: () => set({ layout: { mode: 'tabs' } }),

  getTerminalContext: () => get().outputLines.join('\n'),

  getShellConnectedSessionId: () => {
    const { focusedSessionId, activeSessionId, terminalSessionStatuses } = get();
    const sid = focusedSessionId || activeSessionId;
    if (terminalSessionStatuses[sid]?.kind === 'disconnected') return undefined;
    return sid;
  },

  hydrateFromPersisted: (payload) =>
    set({
      sessions: payload.sessions,
      activeSessionId: payload.activeSessionId,
      focusedSessionId: payload.focusedSessionId,
      layout: payload.layout,
      controllers: {},
      outputLines: [],
      terminalSessionStatuses: Object.fromEntries(
        payload.sessions.map((x) => [x.id, snapshotReady()] as const)
      ),
      terminalSessionExitOscEnabled: Object.fromEntries(
        payload.sessions.map((x) => [x.id, false] as const)
      ),
    }),

  getPersistedSnapshot: () => {
    const { sessions, activeSessionId, focusedSessionId, layout } = get();
    return { sessions, activeSessionId, focusedSessionId, layout };
  },
}));
