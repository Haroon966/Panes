import { ChatSidebar } from '../Chat/ChatSidebar';
import { TerminalPanel } from '../Terminal/TerminalPanel';

export function MainLayout() {
  return (
    <div className="flex h-screen min-h-0 w-full min-w-[900px] flex-row bg-terminalai-bg text-terminalai-text">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TerminalPanel />
      </div>
      <aside className="flex h-screen w-[450px] shrink-0 flex-col border-l border-terminalai-border bg-terminalai-chat">
        <ChatSidebar />
      </aside>
    </div>
  );
}
