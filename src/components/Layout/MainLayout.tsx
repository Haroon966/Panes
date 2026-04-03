export function MainLayout() {
  return (
    <div className="flex min-h-screen min-w-[900px] bg-terminalai-bg text-terminalai-text">
      <main className="min-h-screen flex-1 border-r border-terminalai-border bg-terminalai-terminal p-4 font-mono text-sm">
        <p className="text-terminalai-muted">Terminal panel — Phase 0 bootstrap</p>
      </main>
      <aside className="w-[450px] shrink-0 bg-terminalai-chat p-4 text-sm">
        <p className="text-terminalai-muted">Chat sidebar (450px) — Phase 0 bootstrap</p>
      </aside>
    </div>
  );
}
