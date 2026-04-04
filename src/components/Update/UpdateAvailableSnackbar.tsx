import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_STORAGE_KEY = 'terminalai-dismissed-update';

type UpdateCheckResponse = {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseUrl: string;
  checkedAt: string;
  error?: string;
};

export function UpdateAvailableSnackbar() {
  const [payload, setPayload] = useState<UpdateCheckResponse | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);

  useEffect(() => {
    const local = import.meta.env.VITE_APP_VERSION || '';
    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/app/update-check?local=${encodeURIComponent(local)}`,
          { signal: ac.signal },
        );
        if (!r.ok) return;
        const j = (await r.json()) as UpdateCheckResponse;
        setPayload(j);
      } catch {
        /* ignore */
      }
    })();
    return () => ac.abort();
  }, []);

  const storageDismissed = useMemo(() => {
    if (!payload?.latestVersion) return false;
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === payload.latestVersion;
    } catch {
      return false;
    }
  }, [payload?.latestVersion]);

  if (
    !payload?.updateAvailable ||
    !payload.latestVersion ||
    storageDismissed ||
    userDismissed
  ) {
    return null;
  }

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, payload.latestVersion!);
    } catch {
      /* ignore */
    }
    setUserDismissed(true);
  };

  return (
    <div
      className="fixed top-4 right-4 z-[200] flex max-w-sm flex-col gap-2 rounded-lg border border-terminalai-border bg-terminalai-surface px-3 py-2.5 text-terminalai-text shadow-lg"
      role="status"
    >
      <div className="flex items-start gap-2 pr-1">
        <p className="min-w-0 flex-1 text-sm leading-snug">
          A new version is available ({payload.latestVersion}).
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-terminalai-muted hover:text-terminalai-text"
          aria-label="Dismiss update notice"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {payload.releaseUrl ? (
        <a
          href={payload.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-terminalai-accent underline-offset-2 hover:underline"
        >
          View release
        </a>
      ) : null}
    </div>
  );
}
