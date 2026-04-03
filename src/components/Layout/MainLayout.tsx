import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ChatSidebar } from '../Chat/ChatSidebar';
import { TerminalPanel } from '../Terminal/TerminalPanel';

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen min-h-0 w-full min-w-0 flex-row bg-terminalai-bg text-terminalai-text">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-terminalai-border px-3 py-1.5 md:hidden">
          <span className="text-xs font-medium text-terminalai-muted">TerminalAI</span>
        </div>
        <TerminalPanel />
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="group flex w-3 shrink-0 items-center justify-center border-l border-r border-terminalai-border bg-terminalai-bg hover:bg-terminalai-border/30"
        title={collapsed ? 'Show chat' : 'Hide chat'}
      >
        {collapsed ? (
          <ChevronLeft className="h-4 w-4 text-terminalai-muted opacity-0 group-hover:opacity-100" />
        ) : (
          <ChevronRight className="h-4 w-4 text-terminalai-muted opacity-0 group-hover:opacity-100" />
        )}
      </button>
      {!collapsed && (
        <div className="flex shrink-0 border-l border-terminalai-border">
          <ChatSidebar />
        </div>
      )}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="fixed right-2 top-1/2 z-40 -translate-y-1/2 rounded-l border border-terminalai-border bg-terminalai-chat px-1 py-3 text-xs text-terminalai-muted shadow-lg md:static md:translate-y-0"
        >
          Chat
        </button>
      )}
    </div>
  );
}
