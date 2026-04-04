import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ChatA11yAnnouncer } from '@/components/Chat/A11yAnnouncer';
import { ApiKeyModal } from '@/components/ModelSelector/ApiKeyModal';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useKeyboardShortcutsPalette } from '@/hooks/useKeyboardShortcutsPalette';
import { useLocalModels } from '@/hooks/useLocalModels';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ChatSidebar } from '../Chat/ChatSidebar';
import { TerminalPanel } from '../Terminal/TerminalPanel';

export function MainLayout() {
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const modelsCatalog = useLocalModels(30000);
  const [keysOpen, setKeysOpen] = useState(false);
  const openKeys = () => setKeysOpen(true);
  const { dialog: shortcutsDialog, trigger: shortcutsTrigger, iconTrigger: shortcutsIconTrigger } =
    useKeyboardShortcutsPalette(openKeys);

  useEffect(() => {
    if (keysOpen) useChatStore.getState().setShowManageKeysCallout(false);
  }, [keysOpen]);

  return (
    <>
      {shortcutsDialog}
      <ChatA11yAnnouncer />
      <ApiKeyModal open={keysOpen} onClose={() => setKeysOpen(false)} />
      <div className="relative flex h-screen min-h-0 w-full min-w-0 flex-col bg-terminalai-base text-terminalai-text md:flex-row">
      {agentPanelOpen && (
        <a
          href="#terminalai-chat-panel"
          className="terminalai-skip-link"
        >
          Skip to chat
        </a>
      )}
      {agentPanelOpen && (
        <div
          id="terminalai-chat-panel"
          tabIndex={-1}
          className="order-2 flex h-[min(42vh,340px)] min-h-0 w-full shrink-0 flex-col border-t border-terminalai-border outline-none md:order-1 md:h-auto md:w-[670px] md:border-r md:border-t-0"
        >
          <ChatSidebar
            catalog={modelsCatalog}
            onManageKeys={openKeys}
            shortcutsTrigger={shortcutsTrigger}
            shortcutsIconTrigger={shortcutsIconTrigger}
          />
        </div>
      )}
      {agentPanelOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAgentPanelOpen(false)}
              className="order-3 hidden h-full w-1 shrink-0 cursor-col-resize flex-col border-0 bg-transparent p-0 md:order-2 md:flex md:flex-col"
              aria-label="Hide agent panel"
            >
              <span className="min-h-0 flex-1 bg-transparent transition-colors hover:bg-terminalai-accent" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Hide agent panel</TooltipContent>
        </Tooltip>
      )}
      <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col md:order-3">
        <div className="flex shrink-0 items-center gap-2 border-b border-terminalai-border px-3 py-1.5 md:hidden">
          <span className="text-xs font-medium text-terminalai-muted">TerminalAI</span>
          {agentPanelOpen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-2xs text-terminalai-muted"
              onClick={() => setAgentPanelOpen(false)}
            >
              Hide agent
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <TerminalPanel />
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
              className="fixed left-2 top-1/2 z-40 h-auto -translate-y-1/2 gap-1 rounded-lg border-terminalai-border bg-terminalai-elevated px-2 py-3 text-2xs text-terminalai-muted shadow-md hover:bg-terminalai-hover hover:text-terminalai-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminalai-accent focus-visible:ring-offset-2 focus-visible:ring-offset-terminalai-base md:left-0 md:rounded-l-none md:rounded-r-md md:border-l-0 md:pl-1"
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
