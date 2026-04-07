import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useWorkbenchStore } from '@/store/workbenchStore';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

const mod = isMac ? '⌘' : 'Ctrl';

type Row = { action: string; keys: string };

const STATIC_ROWS: Row[] = [
  { action: 'Send message', keys: 'Enter' },
  { action: 'New line in message', keys: 'Shift + Enter' },
  {
    action: 'Undo / Redo in chat input',
    keys: `${mod} + Z · ${mod} + Shift + Z`,
  },
  {
    action: 'Open command palette',
    keys: `${mod} + Shift + K · ${mod} + Shift + P`,
  },
  {
    action: 'Open command palette (when not in workspace editor)',
    keys: `${mod} + K`,
  },
];

/** When a workspace tab is active, prefix quick-action prompts so the model knows which file to read. */
function buildAgentQuickActionInput(prompt: string, activeEditorPath: string | null): string {
  const p = activeEditorPath?.trim().replace(/\\/g, '/') ?? '';
  if (!p) return prompt;
  return `Workspace editor (active file): \`${p}\`\n\n${prompt}`;
}

const WORKBENCH_ROWS: Row[] = [
  {
    action:
      'Ask agent from workspace editor (opens chat; includes selection in a code block when non-empty)',
    keys: `${mod} + K`,
  },
  {
    action: 'Focus chat (opens agent panel; adds active workspace file to input when editor is open)',
    keys: `${mod} + L`,
  },
  { action: 'Toggle terminal panel (split)', keys: `${mod} + \`` },
  { action: 'Toggle file explorer sidebar', keys: `${mod} + B` },
  {
    action: 'Undo / Redo in workspace editor (Monaco buffer)',
    keys: `${mod} + Z · ${mod} + Shift + Z`,
  },
  { action: 'Open path from chat (assistant inline `path`)', keys: 'Click' },
];

/** Prefills chat when the user picks “Write tests for this” in the shortcuts dialog. */
export const WRITE_TESTS_CHAT_PREFILL =
  'Please add or extend automated tests for what we are working on. Follow this repo’s existing test framework and patterns. When done, suggest how to run tests (e.g. npm test) and what to expect.';

export const EXPLAIN_SELECTED_CODE_CHAT_PREFILL =
  'Please explain the selected code or the active workspace file: what it does, key APIs, and any non-obvious behavior. If I did not paste a snippet, read the file with your tools and explain the relevant parts.';

export const GENERATE_DOCS_FILE_CHAT_PREFILL =
  'Please add or improve documentation for the active file (or any code I paste below): file- or module-level overview, public API summaries, and brief usage notes. Match this repo’s documentation style.';

export const FIND_BUGS_FILE_CHAT_PREFILL =
  'Please review the active file (or any code I paste below) for likely bugs, edge cases, and security issues. Be specific and suggest fixes. Use workspace tools to read the file if needed.';

function rowMatches(query: string, r: Row): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return r.action.toLowerCase().includes(q) || r.keys.toLowerCase().includes(q);
}

type TerminalPaletteDef = {
  key: string;
  label: string;
  cmd: string;
  span?: boolean;
  title?: string;
};

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  onOpenApiKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenApiKeys: () => void;
}) {
  const [paletteQuery, setPaletteQuery] = useState('');
  const filterRef = useRef<HTMLInputElement>(null);

  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setHistoryPanelOpen = useSettingsStore((s) => s.setHistoryPanelOpen);
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const requestFocusChat = useChatStore((s) => s.requestFocusChat);
  const setInput = useChatStore((s) => s.setInput);
  const newChat = useChatStore((s) => s.newChat);
  const activeWorkspaceEditorPath = useWorkbenchStore((s) => s.activeWorkspaceEditorPath);
  const pasteAndRun = useTerminalStore((s) => s.pasteAndRun);
  const canRunInTerminal = useTerminalStore((s) => {
    const sid = s.focusedSessionId || s.activeSessionId;
    return Boolean(sid && s.controllers[sid]);
  });

  useEffect(() => {
    if (!open) return;
    setPaletteQuery('');
    const id = requestAnimationFrame(() => filterRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const q = paletteQuery.trim();

  const runTerminalCommand = (cmd: string) => {
    if (!canRunInTerminal) return;
    pasteAndRun(cmd);
    onOpenChange(false);
  };

  const openAgentWithQuickActionPrefill = useCallback(
    (prompt: string) => {
      setAgentPanelOpen(true);
      setInput(buildAgentQuickActionInput(prompt, activeWorkspaceEditorPath));
      requestFocusChat();
      onOpenChange(false);
    },
    [
      activeWorkspaceEditorPath,
      onOpenChange,
      requestFocusChat,
      setAgentPanelOpen,
      setInput,
    ]
  );

  const quickDefs = useMemo(
    () =>
      [
        {
          key: 'new-chat',
          label: 'New chat',
          span: false as const,
          onClick: () => {
            void newChat();
            onOpenChange(false);
          },
        },
        {
          key: 'focus-chat',
          label: 'Focus chat input',
          span: false as const,
          onClick: () => {
            requestFocusChat();
            onOpenChange(false);
          },
        },
        {
          key: 'tests',
          label: 'Write tests for this',
          span: true as const,
          onClick: () => openAgentWithQuickActionPrefill(WRITE_TESTS_CHAT_PREFILL),
        },
        {
          key: 'explain',
          label: 'Explain code / file',
          span: true as const,
          onClick: () => openAgentWithQuickActionPrefill(EXPLAIN_SELECTED_CODE_CHAT_PREFILL),
        },
        {
          key: 'docs',
          label: 'Generate docs for file',
          span: true as const,
          onClick: () => openAgentWithQuickActionPrefill(GENERATE_DOCS_FILE_CHAT_PREFILL),
        },
        {
          key: 'bugs',
          label: 'Find bugs in file',
          span: true as const,
          onClick: () => openAgentWithQuickActionPrefill(FIND_BUGS_FILE_CHAT_PREFILL),
        },
        {
          key: 'agent-panel',
          label: agentPanelOpen ? 'Hide agent panel' : 'Show agent panel',
          span: false as const,
          onClick: () => {
            setAgentPanelOpen(!agentPanelOpen);
            onOpenChange(false);
          },
        },
        {
          key: 'history',
          label: historyPanelOpen ? 'Hide history' : 'Show history',
          span: false as const,
          onClick: () => {
            setHistoryPanelOpen(!historyPanelOpen);
            onOpenChange(false);
          },
        },
        {
          key: 'keys',
          label: 'Manage API keys',
          span: true as const,
          onClick: () => {
            onOpenApiKeys();
            onOpenChange(false);
          },
        },
      ] as const,
    [
      agentPanelOpen,
      historyPanelOpen,
      newChat,
      onOpenApiKeys,
      onOpenChange,
      openAgentWithQuickActionPrefill,
      requestFocusChat,
      setAgentPanelOpen,
      setHistoryPanelOpen,
    ]
  );

  const terminalDefs: TerminalPaletteDef[] = useMemo(
    () => [
      { key: 'npm-test', label: 'Run tests', cmd: 'npm test' },
      { key: 'typecheck', label: 'Typecheck', cmd: 'npm run typecheck' },
      { key: 'lint', label: 'Lint', cmd: 'npm run lint' },
      { key: 'format', label: 'Format (Prettier)', cmd: 'npm run format' },
      { key: 'build', label: 'Build project', cmd: 'npm run build' },
      { key: 'git-st', label: 'Git status', cmd: 'git status' },
      {
        key: 'commit',
        label: 'Commit & push (WIP message)',
        cmd: 'git add -A && git commit -m "chore: wip (TerminalAI)" && git push',
        span: true,
        title:
          'git add -A, commit with a generic WIP message, then git push. Use git commit --amend if you need a different message.',
      },
    ],
    []
  );

  const filteredStatic = useMemo(() => STATIC_ROWS.filter((r) => rowMatches(q, r)), [q]);
  const filteredWorkbench = useMemo(() => WORKBENCH_ROWS.filter((r) => rowMatches(q, r)), [q]);
  const filteredQuick = useMemo(
    () => (!q ? quickDefs : quickDefs.filter((d) => d.label.toLowerCase().includes(q.toLowerCase()))),
    [q, quickDefs]
  );
  const filteredTerminal = useMemo(
    () =>
      !q
        ? terminalDefs
        : terminalDefs.filter(
            (d) =>
              d.label.toLowerCase().includes(q.toLowerCase()) ||
              d.cmd.toLowerCase().includes(q.toLowerCase())
          ),
    [q, terminalDefs]
  );

  const showChatSection = filteredStatic.length > 0;
  const showWorkbenchSection = filteredWorkbench.length > 0;
  const showQuickSection = filteredQuick.length > 0;
  const showTerminalSection = filteredTerminal.length > 0;
  const noMatches =
    q.length > 0 &&
    !showChatSection &&
    !showWorkbenchSection &&
    !showQuickSection &&
    !showTerminalSection;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,520px)] overflow-y-auto border-terminalai-border bg-terminalai-elevated text-terminalai-text sm:max-w-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-terminalai-text">Command palette</DialogTitle>
          <DialogDescription className="text-terminalai-muted">
            Shortcuts and quick actions. Open with {mod}+Shift+K, {mod}+Shift+P, or (outside the
            workspace editor) {mod}+K. Type to filter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            ref={filterRef}
            value={paletteQuery}
            onChange={(e) => setPaletteQuery(e.target.value)}
            placeholder="Filter actions…"
            className="h-9 border-terminalai-border bg-terminalai-surface text-sm text-terminalai-text placeholder:text-terminalai-muted"
            aria-label="Filter command palette"
            autoComplete="off"
          />
          {noMatches && (
            <p className="text-xs text-terminalai-muted">No actions match &quot;{q}&quot;.</p>
          )}
          {showChatSection && (
            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
                Chat input
              </p>
              <ul className="space-y-1.5 text-xs">
                {filteredStatic.map((r) => (
                  <li
                    key={r.action}
                    className="flex items-center justify-between gap-3 border-b border-terminalai-borderSubtle py-1.5 last:border-0"
                  >
                    <span className="text-terminalai-text">{r.action}</span>
                    <kbd className="shrink-0 rounded border border-terminalai-border bg-terminalai-surface px-1.5 py-0.5 font-mono text-[10px] text-terminalai-muted">
                      {r.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showWorkbenchSection && (
            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
                Workbench
              </p>
              <ul className="space-y-1.5 text-xs">
                {filteredWorkbench.map((r) => (
                  <li
                    key={r.action}
                    className="flex items-center justify-between gap-3 border-b border-terminalai-borderSubtle py-1.5 last:border-0"
                  >
                    <span className="text-terminalai-text">{r.action}</span>
                    <kbd className="shrink-0 rounded border border-terminalai-border bg-terminalai-surface px-1.5 py-0.5 font-mono text-[10px] text-terminalai-muted">
                      {r.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showQuickSection && (
            <div className="flex flex-col gap-2">
              <p className="text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
                Quick actions
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredQuick.map((d) => (
                  <Button
                    key={d.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={
                      d.span
                        ? 'border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover sm:col-span-2'
                        : 'border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover'
                    }
                    onClick={d.onClick}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {showTerminalSection && (
            <div className="flex flex-col gap-2">
              <p className="text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
                Run in terminal
              </p>
              <p className="text-[11px] leading-snug text-terminalai-muted">
                Pastes into the focused terminal tab and presses Enter. Open the terminal panel and ensure a
                session exists. Commands run in the shell&apos;s current working directory.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredTerminal.map((d) => (
                  <Button
                    key={d.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canRunInTerminal}
                    title={
                      !canRunInTerminal ? 'Open the terminal and create a tab first' : d.title
                    }
                    className={
                      d.span
                        ? 'border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover disabled:opacity-50 sm:col-span-2'
                        : 'border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover disabled:opacity-50'
                    }
                    onClick={() => runTerminalCommand(d.cmd)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
