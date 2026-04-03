import { Plus, X } from 'lucide-react';
import { useTerminalStore } from '@/store/terminalStore';

export function TerminalTabBar() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActive = useTerminalStore((s) => s.setActive);
  const addSession = useTerminalStore((s) => s.addSession);
  const removeSession = useTerminalStore((s) => s.removeSession);
  const renameSession = useTerminalStore((s) => s.renameSession);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {sessions.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActive(tab.id)}
          onDoubleClick={() => {
            const t = window.prompt('Tab name', tab.title);
            if (t) renameSession(tab.id, t);
          }}
          className={`flex max-w-[160px] shrink-0 items-center gap-1 rounded px-2 py-1 text-xs ${
            tab.id === activeSessionId
              ? 'bg-terminalai-border text-terminalai-text'
              : 'text-terminalai-muted hover:bg-terminalai-border/60'
          }`}
        >
          <span className="truncate">{tab.title}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-terminalai-danger/30"
            onClick={(e) => {
              e.stopPropagation();
              removeSession(tab.id);
            }}
            title="Close tab"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
      <button
        type="button"
        onClick={() => addSession()}
        className="shrink-0 rounded p-1 text-terminalai-muted hover:bg-terminalai-border/60 hover:text-terminalai-text"
        title="New tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
