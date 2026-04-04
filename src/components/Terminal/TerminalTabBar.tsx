import { Check, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTerminalStore } from '@/store/terminalStore';
import type { TerminalStatusKind } from '@/utils/terminalSessionStatus';
import { cn } from '@/lib/utils';

function tabChromeKind(kind: TerminalStatusKind): TerminalStatusKind {
  return kind === 'interactive' ? 'running' : kind;
}

function tabStatusClasses(kind: TerminalStatusKind, active: boolean): string {
  const k = tabChromeKind(kind);
  if (active) {
    const base =
      'relative z-[1] border border-b-0 border-terminalai-borderBright border-b-terminalai-base border-t-2 bg-terminalai-base font-semibold text-terminalai-text';
    switch (k) {
      case 'running':
        return cn(
          base,
          'border-t-terminalai-processing text-terminalai-text shadow-[0_0_18px_rgba(59,130,246,0.42)]'
        );
      case 'error':
        return cn(
          base,
          'border-t-terminalai-danger text-terminalai-text shadow-[0_0_18px_rgba(239,68,68,0.38)]'
        );
      case 'disconnected':
        return cn(base, 'border-t-terminalai-muted text-terminalai-muted');
      case 'success':
        return cn(
          base,
          'border-t-terminalai-success text-terminalai-text shadow-[0_0_22px_rgba(34,197,94,0.55)]'
        );
      case 'ready':
        return cn(
          base,
          'border-t-terminalai-success/60 text-terminalai-text shadow-[0_0_8px_rgba(34,197,94,0.15)]'
        );
      default:
        return cn(
          base,
          'border-t-terminalai-muted text-terminalai-text shadow-[0_0_8px_rgba(133,133,168,0.12)]'
        );
    }
  }
  const baseInactive =
    'border border-b-0 border-terminalai-borderSubtle/80 bg-terminalai-base/[0.22] font-normal text-terminalai-mutedDeep/55 hover:border-terminalai-border/60 hover:bg-terminalai-base/40 hover:text-terminalai-muted';
  switch (k) {
    case 'running':
      return cn(baseInactive, 'border-t-2 border-t-terminalai-processing/70');
    case 'error':
      return cn(baseInactive, 'border-t-2 border-t-terminalai-danger/75');
    case 'disconnected':
      return cn(baseInactive, 'border-t-terminalai-muted/40');
    case 'success':
      return cn(baseInactive, 'border-t-2 border-t-terminalai-success');
    case 'ready':
      return cn(baseInactive, 'border-t-2 border-t-transparent');
    default:
      return baseInactive;
  }
}

function TabStatusGlyph({
  kind,
  compact,
}: {
  kind: TerminalStatusKind;
  compact: boolean;
}) {
  const k = tabChromeKind(kind);
  if (k === 'running') {
    return (
      <Loader2
        className={cn(
          'shrink-0 animate-spin text-terminalai-processing',
          compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
        )}
        aria-hidden
      />
    );
  }
  if (k === 'success') {
    return (
      <Check
        className={cn(
          'shrink-0 animate-pulse text-terminalai-success',
          compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
        )}
        strokeWidth={2.5}
        aria-hidden
      />
    );
  }
  if (k === 'error') {
    return (
      <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[10px] font-bold leading-none text-terminalai-danger" aria-hidden>
        ×
      </span>
    );
  }
  if (k === 'ready') {
    return (
      <span
        className={cn('shrink-0 rounded-full bg-terminalai-success', compact ? 'h-2 w-2' : 'h-2.5 w-2.5')}
        aria-hidden
      />
    );
  }
  if (k === 'disconnected') {
    return (
      <span
        className={cn('shrink-0 rounded-full bg-terminalai-muted', compact ? 'h-2 w-2' : 'h-2.5 w-2.5')}
        aria-hidden
      />
    );
  }
  return null;
}

export function TerminalTabBar() {
  const [, setTick] = useState(0);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const terminalSessionStatuses = useTerminalStore((s) => s.terminalSessionStatuses);
  const anyRunning = sessions.some((sess) => {
    const k = terminalSessionStatuses[sess.id]?.kind;
    return k === 'running' || k === 'interactive';
  });
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 400);
    return () => window.clearInterval(id);
  }, [anyRunning]);
  const setActive = useTerminalStore((s) => s.setActive);
  const addSession = useTerminalStore((s) => s.addSession);
  const removeSession = useTerminalStore((s) => s.removeSession);
  const renameSession = useTerminalStore((s) => s.renameSession);

  return (
    <div className="flex min-w-0 flex-1 items-end gap-px overflow-x-auto pt-1">
      {sessions.map((tab) => {
        const active = tab.id === activeSessionId;
        const kind: TerminalStatusKind = terminalSessionStatuses[tab.id]?.kind ?? 'ready';
        const started = terminalSessionStatuses[tab.id]?.runningStartedAtMs;
        const elapsed =
          (kind === 'running' || kind === 'interactive') && started != null
            ? Math.max(0, Date.now() - started)
            : null;
        const elapsedStr =
          elapsed != null
            ? elapsed < 1000
              ? `${(elapsed / 1000).toFixed(1)}s`
              : `${Math.floor(elapsed / 1000)}s`
            : '';

        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'group flex max-w-[200px] shrink-0 items-center gap-1.5 rounded-t-md px-2 py-1 text-[11px] transition-colors duration-150',
                  tabStatusClasses(kind, active)
                )}
              >
                <TabStatusGlyph kind={kind} compact={!active} />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => setActive(tab.id)}
                  onDoubleClick={() => {
                    const t = window.prompt('Tab name', tab.title);
                    if (t) renameSession(tab.id, t);
                  }}
                >
                  {tab.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={cn(
                    'h-5 w-5 shrink-0 opacity-0 transition-opacity hover:bg-[rgba(239,68,68,0.14)] hover:text-terminalai-danger group-hover:opacity-100',
                    active
                      ? 'text-terminalai-muted opacity-100 hover:text-terminalai-danger'
                      : 'text-terminalai-mutedDeep/50 group-hover:text-terminalai-muted'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSession(tab.id);
                  }}
                  aria-label="Close tab"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium">{tab.title}</p>
              {(kind === 'running' || kind === 'interactive') && elapsedStr ? (
                <p className="text-terminalai-muted">{elapsedStr}</p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mb-px h-[22px] w-[22px] shrink-0 rounded-md border border-transparent text-terminalai-mutedDeep hover:border-terminalai-border hover:bg-terminalai-hover hover:text-terminalai-muted"
            onClick={() => addSession()}
            aria-label="New tab"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New tab</TooltipContent>
      </Tooltip>
    </div>
  );
}
