import { Check, Play } from 'lucide-react';
import { useState } from 'react';
import { isDestructiveCommand } from '@/components/Agent/AgentActions';
import { useTerminalStore } from '@/store/terminalStore';

export function CommandButton({ command }: { command: string }) {
  const [ran, setRan] = useState(false);
  const destructive = isDestructiveCommand(command);

  const onClick = () => {
    useTerminalStore.getState().pasteAndRun(command);
    setRan(true);
    window.setTimeout(() => setRan(false), 1500);
  };

  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
      {destructive && (
        <span className="text-xs text-terminalai-warning" title="Potentially destructive">
          ⚠️
        </span>
      )}
      <button
        type="button"
        title="Paste & Run in Terminal"
        onClick={onClick}
        className="flex h-5 w-5 items-center justify-center rounded border border-terminalai-border bg-terminalai-bg text-terminalai-accent hover:bg-terminalai-border"
      >
        {ran ? <Check className="h-3 w-3 text-terminalai-success" /> : <Play className="h-3 w-3" />}
      </button>
    </div>
  );
}
