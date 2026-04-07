import { useEffect } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import type { RefObject } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWorkbenchStore } from '@/store/workbenchStore';

type Params = {
  terminalPanelRef: RefObject<ImperativePanelHandle | null>;
  workspaceEditorOpen: boolean;
};

/**
 * Global workbench shortcuts (capture phase so they beat Monaco/xterm when possible).
 * - ⌘/Ctrl+L — show agent panel + focus chat input; prepends active workspace file path when the editor has a tab open
 * - ⌘/Ctrl+` — collapse/expand bottom terminal split (when editor+terminal layout)
 * - ⌘/Ctrl+B — toggle workspace file explorer sidebar
 */
export function useWorkbenchHotkeys({ terminalPanelRef, workspaceEditorOpen }: Params): void {
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const requestFocusChat = useChatStore((s) => s.requestFocusChat);
  const injectWorkspaceEditorFileContext = useChatStore((s) => s.injectWorkspaceEditorFileContext);
  const requestToggleFileExplorer = useWorkbenchStore((s) => s.requestToggleFileExplorer);
  const activeWorkspaceEditorPath = useWorkbenchStore((s) => s.activeWorkspaceEditorPath);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

      if (e.key === 'l' || e.key === 'L') {
        if (e.shiftKey) return;
        e.preventDefault();
        setAgentPanelOpen(true);
        requestFocusChat();
        if (activeWorkspaceEditorPath) injectWorkspaceEditorFileContext(activeWorkspaceEditorPath);
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        if (e.shiftKey) return;
        if (!workspaceEditorOpen) return;
        e.preventDefault();
        requestToggleFileExplorer();
        return;
      }

      if (e.code === 'Backquote' && !e.shiftKey) {
        const panel = terminalPanelRef.current;
        if (!workspaceEditorOpen || !panel) return;
        e.preventDefault();
        if (panel.isCollapsed()) {
          panel.expand(22);
        } else {
          panel.collapse();
        }
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [
    workspaceEditorOpen,
    terminalPanelRef,
    setAgentPanelOpen,
    requestFocusChat,
    injectWorkspaceEditorFileContext,
    activeWorkspaceEditorPath,
    requestToggleFileExplorer,
  ]);
}
