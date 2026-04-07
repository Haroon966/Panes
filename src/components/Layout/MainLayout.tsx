import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatA11yAnnouncer } from '@/components/Chat/A11yAnnouncer';
import { ApiKeyModal } from '@/components/ModelSelector/ApiKeyModal';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useKeyboardShortcutsPalette } from '@/hooks/useKeyboardShortcutsPalette';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { useSlideOverPresence } from '@/hooks/useSlideOverPresence';
import { useWorkbenchHotkeys } from '@/hooks/useWorkbenchHotkeys';
import { useLocalModels } from '@/hooks/useLocalModels';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorkbenchStore } from '@/store/workbenchStore';
import { cn } from '@/lib/utils';
import { ChatSidebar } from '../Chat/ChatSidebar';
import { UiErrorBoundary } from './UiErrorBoundary';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { WorkspaceEditorPanel } from '../WorkspaceEditor/WorkspaceEditorPanel';

export function MainLayout() {
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const isNarrowViewport = useMatchMedia('(max-width: 899px)');
  const agentSlideOver = useSlideOverPresence(
    agentPanelOpen && isNarrowViewport,
    isNarrowViewport,
    220
  );
  const modelsCatalog = useLocalModels(30000);
  const [keysOpen, setKeysOpen] = useState(false);
  const [workspaceEditorOpen, setWorkspaceEditorOpen] = useState(true);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const openKeys = () => setKeysOpen(true);
  const { dialog: shortcutsDialog, trigger: shortcutsTrigger, iconTrigger: shortcutsIconTrigger } =
    useKeyboardShortcutsPalette(openKeys);

  useWorkbenchHotkeys({ terminalPanelRef, workspaceEditorOpen });

  const openEditorFileNonce = useWorkbenchStore((s) => s.openEditorFileNonce);
  const prevOpenEditorNonce = useRef(0);
  useEffect(() => {
    if (openEditorFileNonce > prevOpenEditorNonce.current) {
      prevOpenEditorNonce.current = openEditorFileNonce;
      setWorkspaceEditorOpen(true);
    }
  }, [openEditorFileNonce]);

  useEffect(() => {
    if (keysOpen) useChatStore.getState().setShowManageKeysCallout(false);
  }, [keysOpen]);

  return (
    <>
      {shortcutsDialog}
      <ChatA11yAnnouncer />
      <ApiKeyModal open={keysOpen} onClose={() => setKeysOpen(false)} />
      <div className="relative flex h-screen min-h-0 w-full min-w-0 flex-col bg-terminalai-base text-terminalai-text min-[900px]:flex-row">
      {agentPanelOpen && (
        <a
          href="#terminalai-chat-panel"
          className="terminalai-skip-link"
        >
          Skip to chat
        </a>
      )}
      {/* PRD 4.2 / 6: below 900px the agent panel is a slide-over; at 900px+ it is a fixed 450px column. */}
      {agentPanelOpen && !isNarrowViewport && (
        <div
          id="terminalai-chat-panel"
          tabIndex={-1}
          className="order-2 flex min-h-0 w-full shrink-0 flex-col border-t border-terminalai-border bg-terminalai-base outline-none min-[900px]:order-1 min-[900px]:h-auto min-[900px]:w-[450px] min-[900px]:shrink-0 min-[900px]:border-r min-[900px]:border-t-0"
        >
          <UiErrorBoundary
            name="Chat"
            contentClassName="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <ChatSidebar
              catalog={modelsCatalog}
              onManageKeys={openKeys}
              shortcutsTrigger={shortcutsTrigger}
              shortcutsIconTrigger={shortcutsIconTrigger}
            />
          </UiErrorBoundary>
        </div>
      )}
      {agentPanelOpen && !isNarrowViewport && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAgentPanelOpen(false)}
              className="order-3 hidden h-full w-1 shrink-0 cursor-col-resize flex-col border-0 bg-transparent p-0 min-[900px]:order-2 min-[900px]:flex min-[900px]:flex-col"
              aria-label="Hide agent panel"
            >
              <span className="min-h-0 flex-1 bg-transparent transition-colors duration-200 hover:bg-terminalai-accent" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Hide agent panel</TooltipContent>
        </Tooltip>
      )}
      {agentSlideOver.render && isNarrowViewport && (
        <>
          <button
            type="button"
            className={cn(
              'fixed inset-0 z-30 bg-black/45 transition-opacity duration-200 ease-out motion-reduce:transition-none min-[900px]:hidden',
              agentSlideOver.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
            aria-label="Dismiss agent panel"
            onClick={() => setAgentPanelOpen(false)}
          />
          <div
            id="terminalai-chat-panel"
            tabIndex={-1}
            className={cn(
              'order-2 flex min-h-0 w-full shrink-0 flex-col border-t border-terminalai-border bg-terminalai-base outline-none max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:right-0 max-[899px]:z-40 max-[899px]:h-full max-[899px]:w-[min(100vw,450px)] max-[899px]:max-w-[450px] max-[899px]:border-l max-[899px]:border-t-0 max-[899px]:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] max-[899px]:shadow-2xl max-[899px]:transition-transform max-[899px]:duration-200 max-[899px]:ease-out max-[899px]:motion-reduce:transition-none max-[899px]:will-change-transform',
              agentSlideOver.visible ? 'max-[899px]:translate-x-0' : 'max-[899px]:translate-x-full'
            )}
            aria-hidden={!agentPanelOpen}
          >
            <UiErrorBoundary
              name="Chat"
              contentClassName="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <ChatSidebar
                catalog={modelsCatalog}
                onManageKeys={openKeys}
                shortcutsTrigger={shortcutsTrigger}
                shortcutsIconTrigger={shortcutsIconTrigger}
              />
            </UiErrorBoundary>
          </div>
        </>
      )}
      <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col min-[900px]:order-3">
        <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-terminalai-border px-3 py-2 min-[900px]:hidden">
          <span className="text-xs font-medium text-terminalai-muted">TerminalAI</span>
          {agentPanelOpen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto min-h-10 px-3 text-xs text-terminalai-muted"
              onClick={() => setAgentPanelOpen(false)}
            >
              Hide agent
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {workspaceEditorOpen ? (
            <PanelGroup
              direction="vertical"
              className="h-full min-h-0"
              autoSaveId="terminalai-workspace-editor-split"
            >
              <Panel defaultSize={58} minSize={18}>
                <UiErrorBoundary name="Workspace editor">
                  <WorkspaceEditorPanel onClose={() => setWorkspaceEditorOpen(false)} />
                </UiErrorBoundary>
              </Panel>
              <PanelResizeHandle className="h-1.5 shrink-0 cursor-row-resize rounded-sm border-0 bg-transparent transition-colors duration-200 ease-out hover:bg-terminalai-accent motion-reduce:transition-none" />
              <Panel
                ref={terminalPanelRef}
                id="terminalai-terminal-split"
                collapsible
                collapsedSize={4}
                minSize={14}
                defaultSize={42}
              >
                <UiErrorBoundary name="Terminal">
                  <TerminalPanel
                    workspaceEditorOpen={workspaceEditorOpen}
                    onToggleWorkspaceEditor={() => setWorkspaceEditorOpen((o) => !o)}
                  />
                </UiErrorBoundary>
              </Panel>
            </PanelGroup>
          ) : (
            <UiErrorBoundary name="Terminal">
              <TerminalPanel
                workspaceEditorOpen={workspaceEditorOpen}
                onToggleWorkspaceEditor={() => setWorkspaceEditorOpen(true)}
              />
            </UiErrorBoundary>
          )}
        </div>
      </div>
      {!agentPanelOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAgentPanelOpen(true)}
              className="fixed left-2 top-1/2 z-40 min-h-[44px] h-auto -translate-y-1/2 gap-1 rounded-lg border-terminalai-border bg-terminalai-elevated px-2 py-3 text-2xs text-terminalai-muted shadow-md hover:bg-terminalai-hover hover:text-terminalai-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminalai-accent focus-visible:ring-offset-2 focus-visible:ring-offset-terminalai-base min-[900px]:left-0 min-[900px]:rounded-l-none min-[900px]:rounded-r-md min-[900px]:border-l-0 min-[900px]:pl-1"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="max-[480px]:sr-only">Agent</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Show agent panel</TooltipContent>
        </Tooltip>
      )}
      </div>
    </>
  );
}
