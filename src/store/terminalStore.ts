import { create } from 'zustand';

export type SessionId = string;

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
  splitHorizontal: () => void;
  splitVertical: () => void;
  closeSplit: () => void;
  getTerminalContext: () => string;
}

const firstId = newId();

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [{ id: firstId, title: 'Terminal 1' }],
  activeSessionId: firstId,
  focusedSessionId: firstId,
  layout: { mode: 'tabs' },
  controllers: {},
  outputLines: [],

  addSession: (title) => {
    const sid = newId();
    set((s) => ({
      sessions: [...s.sessions, { id: sid, title: title ?? `Terminal ${s.sessions.length + 1}` }],
      activeSessionId: sid,
      focusedSessionId: sid,
      layout: { mode: 'tabs' },
    }));
    return sid;
  },

  removeSession: (id) => {
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id);
      if (sessions.length === 0) {
        const nid = newId();
        return {
          sessions: [{ id: nid, title: 'Terminal 1' }],
          activeSessionId: nid,
          focusedSessionId: nid,
          layout: { mode: 'tabs' },
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
      return { sessions, activeSessionId: active, focusedSessionId: focused, layout };
    });
  },

  setActive: (id) => set({ activeSessionId: id, focusedSessionId: id }),
  setFocused: (id) => set({ focusedSessionId: id }),

  renameSession: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)),
    })),

  registerController: (id, c) =>
    set((s) => ({ controllers: { ...s.controllers, [id]: c } })),

  unregisterController: (id) =>
    set((s) => {
      const next = { ...s.controllers };
      delete next[id];
      return { controllers: next };
    }),

  appendOutputLine: (line) =>
    set((s) => ({
      outputLines: [...s.outputLines, line].slice(-MAX_LINES),
    })),

  clearOutputBuffer: () => set({ outputLines: [] }),

  pasteAndRun: (cmd) => {
    const { focusedSessionId, activeSessionId, controllers } = get();
    const sid = focusedSessionId || activeSessionId;
    const c = controllers[sid];
    if (c) {
      const oneLine = cmd.replace(/\r?\n/g, ' ').trim();
      c.pasteAndRun(oneLine);
    }
  },

  splitHorizontal: () => {
    const { activeSessionId, sessions } = get();
    const right = newId();
    set({
      sessions: [...sessions, { id: right, title: `Terminal ${sessions.length + 1}` }],
      layout: { mode: 'split-h', left: activeSessionId, right },
      activeSessionId: right,
      focusedSessionId: right,
    });
  },

  splitVertical: () => {
    const { activeSessionId, sessions } = get();
    const bottom = newId();
    set({
      sessions: [...sessions, { id: bottom, title: `Terminal ${sessions.length + 1}` }],
      layout: { mode: 'split-v', top: activeSessionId, bottom },
      activeSessionId: bottom,
      focusedSessionId: bottom,
    });
  },

  closeSplit: () => set({ layout: { mode: 'tabs' } }),

  getTerminalContext: () => get().outputLines.join('\n'),
}));
