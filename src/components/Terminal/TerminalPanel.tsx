import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TerminalInstance } from './TerminalInstance';
import { TerminalSplitDropdown } from './TerminalSplitDropdown';
import { TerminalTabBar } from './TerminalTabBar';
import { useTerminalSplit } from '@/hooks/useTerminalSplit';
import { useTerminalStore } from '@/store/terminalStore';

export function TerminalPanel() {
  const { layout } = useTerminalSplit();
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-terminalai-terminal">
      <header className="flex shrink-0 items-center gap-2 border-b border-terminalai-border px-2 py-1">
        <TerminalSplitDropdown />
        {layout.mode === 'tabs' && <TerminalTabBar />}
      </header>
      <div className="min-h-0 flex-1 p-2">
        {layout.mode === 'tabs' && (
          <div className="h-full min-h-0">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={s.id === activeSessionId ? 'h-full min-h-0' : 'hidden'}
              >
                <TerminalInstance sessionId={s.id} />
              </div>
            ))}
          </div>
        )}
        {layout.mode === 'split-h' && (
          <PanelGroup direction="horizontal" className="h-full min-h-[200px]">
            <Panel defaultSize={50} minSize={15}>
              <TerminalInstance sessionId={layout.left} />
            </Panel>
            <PanelResizeHandle className="mx-1 w-1 rounded bg-terminalai-border hover:bg-terminalai-accent" />
            <Panel defaultSize={50} minSize={15}>
              <TerminalInstance sessionId={layout.right} />
            </Panel>
          </PanelGroup>
        )}
        {layout.mode === 'split-v' && (
          <PanelGroup direction="vertical" className="h-full min-h-[200px]">
            <Panel defaultSize={50} minSize={15}>
              <TerminalInstance sessionId={layout.top} />
            </Panel>
            <PanelResizeHandle className="my-1 h-1 rounded bg-terminalai-border hover:bg-terminalai-accent" />
            <Panel defaultSize={50} minSize={15}>
              <TerminalInstance sessionId={layout.bottom} />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
