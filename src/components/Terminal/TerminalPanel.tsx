import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTerminalSplit } from '@/hooks/useTerminalSplit';
import { useSettingsStore } from '@/store/settingsStore';
import { useTerminalStore } from '@/store/terminalStore';
import { TerminalInstance } from './TerminalInstance';
import { TerminalSplitDropdown } from './TerminalSplitDropdown';
import { TerminalTabBar } from './TerminalTabBar';

export function TerminalPanel() {
  const { pathname } = useLocation();
  const showAgentPanelToggle = pathname === '/' || pathname === '';
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const { layout } = useTerminalSplit();
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-terminalai-base">
      <header className="flex shrink-0 items-center gap-2 border-b border-terminalai-border bg-terminalai-surface px-3 py-2">
        <TerminalSplitDropdown />
        {layout.mode === 'tabs' && <TerminalTabBar />}
        {showAgentPanelToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-terminalai-muted hover:text-terminalai-text"
                aria-label={agentPanelOpen ? 'Hide agent panel' : 'Show agent panel'}
                aria-pressed={agentPanelOpen}
                onClick={() => setAgentPanelOpen(!agentPanelOpen)}
              >
                {agentPanelOpen ? (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {agentPanelOpen ? 'Hide agent panel' : 'Show agent panel'}
            </TooltipContent>
          </Tooltip>
        )}
      </header>
      <div className="min-h-0 flex-1 p-3">
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
            <PanelResizeHandle className="mx-1 w-1 cursor-col-resize rounded-sm bg-transparent hover:bg-terminalai-accent" />
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
            <PanelResizeHandle className="my-1 h-1 cursor-row-resize rounded-sm bg-terminalai-border hover:bg-terminalai-accent" />
            <Panel defaultSize={50} minSize={15}>
              <TerminalInstance sessionId={layout.bottom} />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
