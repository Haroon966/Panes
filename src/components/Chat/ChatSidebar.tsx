/** Phase 7 — 450px chat panel (placeholder shell) */
export function ChatSidebar() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-terminalai-border px-4 py-3">
        <span className="text-sm font-semibold text-terminalai-text">TerminalAI</span>
        <p className="mt-0.5 text-xs text-terminalai-muted">Chat — coming in Phase 7</p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 text-sm text-terminalai-muted" />
    </div>
  );
}
