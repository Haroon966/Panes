import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '@/store/terminalStore';

type ToastItem = { id: string; message: string; variant: 'success' | 'error' };

const TOAST_MS = 4500;

/**
 * When a background tab finishes a command (tabs layout only), show a short unobtrusive notice.
 */
export function TerminalBackgroundToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevKindsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const init = useTerminalStore.getState();
    prevKindsRef.current = Object.fromEntries(
      init.sessions.map((sess) => [sess.id, init.terminalSessionStatuses[sess.id]?.kind ?? 'ready'])
    );
    return useTerminalStore.subscribe((s) => {
      const statuses = s.terminalSessionStatuses;
      const nextKinds: Record<string, string> = {};

      if (s.layout.mode !== 'tabs') {
        for (const sess of s.sessions) {
          nextKinds[sess.id] = statuses[sess.id]?.kind ?? 'ready';
        }
        prevKindsRef.current = nextKinds;
        return;
      }

      for (const sess of s.sessions) {
        const id = sess.id;
        const now = statuses[id]?.kind ?? 'ready';
        const was = prevKindsRef.current[id] ?? 'ready';
        nextKinds[id] = now;

        if (id !== s.activeSessionId && was === 'running' && now === 'success') {
          const tid = crypto.randomUUID();
          setToasts((t) => [...t.slice(-4), { id: tid, variant: 'success', message: `Command completed successfully in ${sess.title}` }]);
          window.setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== tid));
          }, TOAST_MS);
        }
        if (id !== s.activeSessionId && was === 'running' && now === 'error') {
          const tid = crypto.randomUUID();
          setToasts((t) => [...t.slice(-4), { id: tid, variant: 'error', message: `Command failed in ${sess.title}` }]);
          window.setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== tid));
          }, TOAST_MS);
        }
      }

      prevKindsRef.current = nextKinds;
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex max-w-sm flex-col gap-2 p-0"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm',
            t.variant === 'success' &&
              'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] text-terminalai-text',
            t.variant === 'error' &&
              'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] text-terminalai-text'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
