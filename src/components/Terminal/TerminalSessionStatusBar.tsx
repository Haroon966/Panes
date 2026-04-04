import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTerminalStore } from '@/store/terminalStore';
import type { TerminalStatusKind } from '@/utils/terminalSessionStatus';
import { DEFAULT_LABELS } from '@/utils/terminalSessionStatus';
import { cn } from '@/lib/utils';

/** Semantic UI: Success #22C55E, Error #EF4444, Running blue #3B82F6 */
const ROW: Record<
  TerminalStatusKind,
  { dot: string; ring: string; row: string; hint: string }
> = {
  ready: {
    dot: 'bg-terminalai-success',
    ring: '',
    row: 'border-terminalai-borderSubtle bg-terminalai-surface',
    hint: 'Waiting for input',
  },
  running: {
    dot: 'bg-terminalai-processing',
    ring: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    row: 'border-[rgba(59,130,246,0.22)] bg-[rgba(59,130,246,0.08)]',
    hint: 'In progress — output may still stream',
  },
  success: {
    dot: 'bg-terminalai-success',
    ring: 'shadow-[0_0_12px_rgba(34,197,94,0.65)]',
    row: 'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)]',
    hint: 'Last command finished successfully',
  },
  error: {
    dot: 'bg-terminalai-danger',
    ring: 'shadow-[0_0_10px_rgba(239,68,68,0.45)]',
    row: 'border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)]',
    hint: 'Fix and retry, or type to dismiss',
  },
  interactive: {
    dot: 'bg-terminalai-warning',
    ring: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]',
    row: 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.09)]',
    hint: 'Respond in the terminal',
  },
  disconnected: {
    dot: 'bg-terminalai-muted',
    ring: '',
    row: 'border-terminalai-borderSubtle',
    hint: 'Reconnect by refreshing the page',
  },
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

export function TerminalSessionStatusBar({ sessionId }: { sessionId: string }) {
  const snap = useTerminalStore((s) => s.terminalSessionStatuses[sessionId]);
  const kind = snap?.kind ?? 'ready';
  const label = snap?.label ?? DEFAULT_LABELS.ready;
  const started = snap?.runningStartedAtMs;
  const row = ROW[kind];

  const [, setTick] = useState(0);
  useEffect(() => {
    if ((kind !== 'running' && kind !== 'interactive') || started == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [kind, started]);

  const elapsed =
    (kind === 'running' || kind === 'interactive') && started != null
      ? Math.max(0, Date.now() - started)
      : null;

  const displayKind: TerminalStatusKind =
    kind === 'interactive' ? 'running' : kind;
  const displayRow = ROW[displayKind];

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 border-t px-3.5 py-1.5 text-[10px] text-terminalai-muted transition-colors',
        displayRow.row
      )}
      role="status"
      aria-live="polite"
      aria-label={`Terminal status: ${label}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {kind === 'running' || kind === 'interactive' ? (
          <Loader2
            className={cn(
              'h-3 w-3 shrink-0 animate-spin text-terminalai-processing',
              displayRow.ring
            )}
            aria-hidden
          />
        ) : (
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
              displayRow.dot,
              displayRow.ring,
              kind === 'success' && 'animate-pulse'
            )}
            aria-hidden
          />
        )}
        <span
          className={cn(
            'truncate font-medium',
            kind === 'ready' && 'text-terminalai-success',
            kind === 'success' && 'text-terminalai-success',
            (kind === 'running' || kind === 'interactive') && 'text-terminalai-processing',
            kind === 'error' && 'text-terminalai-danger',
            kind === 'disconnected' && 'text-terminalai-muted'
          )}
        >
          {label}
          {elapsed != null && (
            <span className="ml-1.5 font-normal text-terminalai-muted">
              {formatElapsed(elapsed)}
            </span>
          )}
        </span>
      </span>
      <span className="ml-auto hidden shrink-0 text-terminalai-mutedDeep sm:inline">{row.hint}</span>
    </div>
  );
}
