import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

const mod = isMac ? '⌘' : 'Ctrl';

type Row = { action: string; keys: string };

const STATIC_ROWS: Row[] = [
  { action: 'Send message', keys: 'Enter' },
  { action: 'New line in message', keys: 'Shift + Enter' },
  { action: 'Open this palette', keys: `${mod} + K` },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  onOpenApiKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenApiKeys: () => void;
}) {
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const agentPanelOpen = useSettingsStore((s) => s.agentPanelOpen);
  const setHistoryPanelOpen = useSettingsStore((s) => s.setHistoryPanelOpen);
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const requestFocusChat = useChatStore((s) => s.requestFocusChat);
  const newChat = useChatStore((s) => s.newChat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,520px)] overflow-y-auto border-terminalai-border bg-terminalai-elevated text-terminalai-text sm:max-w-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-terminalai-text">Shortcuts &amp; actions</DialogTitle>
          <DialogDescription className="text-terminalai-muted">
            Keyboard shortcuts and quick actions. Use {mod}+K anytime to open this dialog.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
              Chat input
            </p>
            <ul className="space-y-1.5 text-xs">
              {STATIC_ROWS.map((r) => (
                <li
                  key={r.action}
                  className="flex items-center justify-between gap-3 border-b border-terminalai-borderSubtle py-1.5 last:border-0"
                >
                  <span className="text-terminalai-text">{r.action}</span>
                  <kbd className="shrink-0 rounded border border-terminalai-border bg-terminalai-surface px-1.5 py-0.5 font-mono text-[10px] text-terminalai-muted">
                    {r.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
              Quick actions
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover"
                onClick={() => {
                  void newChat();
                  onOpenChange(false);
                }}
              >
                New chat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover"
                onClick={() => {
                  requestFocusChat();
                  onOpenChange(false);
                }}
              >
                Focus chat input
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover"
                onClick={() => {
                  setAgentPanelOpen(!agentPanelOpen);
                  onOpenChange(false);
                }}
              >
                {agentPanelOpen ? 'Hide agent panel' : 'Show agent panel'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover"
                onClick={() => {
                  setHistoryPanelOpen(!historyPanelOpen);
                  onOpenChange(false);
                }}
              >
                {historyPanelOpen ? 'Hide history' : 'Show history'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-terminalai-border bg-terminalai-surface text-xs text-terminalai-text hover:bg-terminalai-hover sm:col-span-2"
                onClick={() => {
                  onOpenApiKeys();
                  onOpenChange(false);
                }}
              >
                Manage API keys
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

