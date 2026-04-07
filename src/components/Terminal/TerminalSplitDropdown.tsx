import { Columns2, LayoutGrid, Monitor, Rows2, SquarePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTerminalSplit } from '@/hooks/useTerminalSplit';
import { TERMINAL_TAB_NAME_PRESETS, useTerminalStore } from '@/store/terminalStore';

export function TerminalSplitDropdown() {
  const { layout, splitHorizontal, splitVertical, closeSplit } = useTerminalSplit();
  const addSession = useTerminalStore((s) => s.addSession);

  const openNewWindow = () => {
    window.open(
      `${window.location.origin}/terminal-only`,
      '_blank',
      'noopener,noreferrer,width=960,height=640'
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 px-2 text-xs text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
          title="Terminal layout"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Terminal</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuItem
          onSelect={() => {
            splitHorizontal();
          }}
        >
          <Columns2 className="h-4 w-4" />
          Split horizontally
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            splitVertical();
          }}
        >
          <Rows2 className="h-4 w-4" />
          Split vertically
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            addSession();
          }}
        >
          <SquarePlus className="h-4 w-4" />
          New tab (numbered)
        </DropdownMenuItem>
        {TERMINAL_TAB_NAME_PRESETS.map((name) => (
          <DropdownMenuItem
            key={name}
            onSelect={() => {
              addSession(name);
            }}
          >
            <SquarePlus className="h-4 w-4" />
            New tab: {name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openNewWindow}>
          <Monitor className="h-4 w-4" />
          Open in new window
        </DropdownMenuItem>
        {layout.mode !== 'tabs' && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              closeSplit();
            }}
          >
            <X className="h-4 w-4" />
            Close split (tabs)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
