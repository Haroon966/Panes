import { Columns2, LayoutGrid, Monitor, Rows2, SquarePlus, X } from 'lucide-react';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTerminalSplit } from '@/hooks/useTerminalSplit';
import { useTerminalStore } from '@/store/terminalStore';

export function TerminalSplitDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { layout, splitHorizontal, splitVertical, closeSplit } = useTerminalSplit();
  const addSession = useTerminalStore((s) => s.addSession);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openNewWindow = () => {
    window.open(
      `${window.location.origin}/terminal-only`,
      '_blank',
      'noopener,noreferrer,width=960,height=640'
    );
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-terminalai-muted hover:bg-terminalai-border/50 hover:text-terminalai-text"
        title="Terminal layout"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Terminal</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded border border-terminalai-border bg-terminalai-chat py-1 shadow-lg">
          <MenuRow
            icon={<Columns2 className="h-4 w-4" />}
            label="Split horizontally"
            onClick={() => {
              splitHorizontal();
              setOpen(false);
            }}
          />
          <MenuRow
            icon={<Rows2 className="h-4 w-4" />}
            label="Split vertically"
            onClick={() => {
              splitVertical();
              setOpen(false);
            }}
          />
          <MenuRow
            icon={<SquarePlus className="h-4 w-4" />}
            label="New tab"
            onClick={() => {
              addSession();
              setOpen(false);
            }}
          />
          <MenuRow
            icon={<Monitor className="h-4 w-4" />}
            label="Open in new window"
            onClick={openNewWindow}
          />
          {layout.mode !== 'tabs' && (
            <MenuRow
              icon={<X className="h-4 w-4" />}
              label="Close split (tabs)"
              onClick={() => {
                closeSplit();
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-terminalai-text hover:bg-terminalai-border/40"
    >
      {icon}
      {label}
    </button>
  );
}
