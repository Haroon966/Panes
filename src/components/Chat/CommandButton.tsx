import { Check, Play } from 'lucide-react';
import { useState } from 'react';
import { isDestructiveCommand } from '@/components/Agent/AgentActions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-xs text-terminalai-warning" tabIndex={0}>
              ⚠️
            </span>
          </TooltipTrigger>
          <TooltipContent>Potentially destructive command</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="h-5 w-5 border-[rgba(124,106,247,0.3)] bg-[rgba(124,106,247,0.15)] text-terminalai-accentText hover:border-terminalai-accent hover:bg-terminalai-accent hover:text-white"
            onClick={onClick}
            aria-label="Paste and run in terminal"
          >
            {ran ? (
              <Check className="h-3 w-3 text-terminalai-success" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Paste and run in terminal</TooltipContent>
      </Tooltip>
    </div>
  );
}
