import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/store/chatStore';

export function ErrorReference() {
  const ctx = useChatStore((s) => s.pendingErrorContext);
  const clear = () => useChatStore.getState().setErrorContext(null);

  if (!ctx) return null;

  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] px-2.5 py-1.5 text-xs text-terminalai-warning">
      <span>⚠ error ref attached</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto h-6 w-6 shrink-0"
            onClick={clear}
            aria-label="Dismiss error reference"
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dismiss</TooltipContent>
      </Tooltip>
    </div>
  );
}
