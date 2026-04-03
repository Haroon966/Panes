import { X } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export function ErrorReference() {
  const ctx = useChatStore((s) => s.pendingErrorContext);
  const clear = () => useChatStore.getState().setErrorContext(null);

  if (!ctx) return null;

  return (
    <div className="mb-2 flex items-center gap-2 rounded border border-terminalai-warning/50 bg-terminalai-warning/10 px-2 py-1 text-xs text-terminalai-warning">
      <span>⚠ error ref attached</span>
      <button
        type="button"
        onClick={clear}
        className="ml-auto rounded p-0.5 hover:bg-terminalai-border/40"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
