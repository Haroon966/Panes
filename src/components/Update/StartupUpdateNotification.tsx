import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISS_STORAGE_KEY = 'terminalai-dismissed-update';
const UP_TO_DATE_MS = 2200;
const CHECK_ERROR_MS = 2200;

type UpdateCheckResponse = {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseUrl: string;
  checkedAt: string;
  error?: string;
  installSupported?: boolean;
};

type Phase =
  | 'checking'
  | 'uptodate'
  | 'check_error'
  | 'update'
  | 'installing'
  | 'after_install'
  | 'ready';

type InstallOutcome = { ok: boolean; output: string };

function readDismissed(latest: string | null): boolean {
  if (!latest) return false;
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === latest;
  } catch {
    return false;
  }
}

/**
 * Non-blocking update notice: checks on startup and shows a corner card instead of a full-screen overlay.
 */
export function StartupUpdateNotification() {
  const localVersion = import.meta.env.VITE_APP_VERSION || '';
  const [phase, setPhase] = useState<Phase>(() => (localVersion ? 'checking' : 'ready'));
  const [payload, setPayload] = useState<UpdateCheckResponse | null>(null);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome | null>(null);

  useEffect(() => {
    if (!localVersion) return;

    const ac = new AbortController();
    (async () => {
      try {
        const r = await fetch(
          `/api/app/update-check?local=${encodeURIComponent(localVersion)}`,
          { signal: ac.signal },
        );
        if (!r.ok) {
          setPhase('check_error');
          return;
        }
        const j = (await r.json()) as UpdateCheckResponse;
        setPayload(j);

        if (j.error) {
          setPhase('check_error');
          return;
        }

        if (
          j.updateAvailable &&
          j.latestVersion &&
          readDismissed(j.latestVersion)
        ) {
          setPhase('ready');
          return;
        }

        if (j.updateAvailable && j.latestVersion) {
          setPhase('update');
          return;
        }

        setPhase('uptodate');
      } catch {
        if (!ac.signal.aborted) setPhase('check_error');
      }
    })();

    return () => {
      ac.abort();
    };
  }, [localVersion]);

  useEffect(() => {
    if (phase !== 'uptodate' && phase !== 'check_error') return;
    const ms = phase === 'uptodate' ? UP_TO_DATE_MS : CHECK_ERROR_MS;
    const t = setTimeout(() => setPhase('ready'), ms);
    return () => clearTimeout(t);
  }, [phase]);

  const skipUpdate = () => {
    if (payload?.latestVersion) {
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, payload.latestVersion);
      } catch {
        /* ignore */
      }
    }
    setPhase('ready');
  };

  const runInstall = async () => {
    setInstallOutcome(null);
    setPhase('installing');
    try {
      const r = await fetch('/api/app/install-update', { method: 'POST' });
      let j: { ok?: boolean; output?: string; error?: string } = {};
      try {
        j = (await r.json()) as typeof j;
      } catch {
        /* ignore */
      }
      if (r.ok && j.ok) {
        setInstallOutcome({ ok: true, output: (j.output || '').trimEnd() });
      } else {
        const detail =
          (j.output || '').trimEnd() ||
          j.error ||
          `HTTP ${r.status}`;
        setInstallOutcome({ ok: false, output: detail });
      }
    } catch (e) {
      setInstallOutcome({
        ok: false,
        output: e instanceof Error ? e.message : 'Request failed',
      });
    }
    setPhase('after_install');
  };

  if (phase === 'ready') {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-[100] flex max-w-md flex-col gap-2 p-0"
      role="region"
      aria-label="App update"
      aria-busy={phase === 'checking' || phase === 'installing'}
    >
      <div
        className={cn(
          'pointer-events-auto rounded-xl border border-terminalai-border bg-terminalai-surface px-4 py-3 shadow-xl backdrop-blur-sm',
          phase === 'checking' && 'py-3',
        )}
      >
        {phase === 'checking' ? (
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-terminalai-accent" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">Checking for updates</p>
              <p className="mt-0.5 text-2xs text-terminalai-muted">
                Comparing your version with the latest release…
              </p>
            </div>
          </div>
        ) : null}

        {phase === 'uptodate' ? (
          <div>
            <p className="text-sm font-medium">You&apos;re up to date</p>
            <p className="mt-1 text-2xs text-terminalai-muted">
              Version {localVersion} is the latest.
            </p>
          </div>
        ) : null}

        {phase === 'check_error' ? (
          <div>
            <p className="text-sm font-medium">Couldn&apos;t check for updates</p>
            <p className="mt-1 text-2xs text-terminalai-muted">
              You can keep using the app. We&apos;ll try again next time.
            </p>
          </div>
        ) : null}

        {phase === 'update' && payload ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Update available</p>
                <p className="mt-1 text-2xs leading-relaxed text-terminalai-muted">
                  Version <span className="text-terminalai-text">{payload.latestVersion}</span> is
                  available. You are on{' '}
                  <span className="text-terminalai-text">{localVersion}</span>.
                </p>
              </div>
              <button
                type="button"
                className="-m-1 shrink-0 rounded-md p-1 text-terminalai-muted hover:bg-terminalai-overlay hover:text-terminalai-text"
                aria-label="Dismiss update notice"
                onClick={skipUpdate}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {payload.installSupported ? (
                <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => void runInstall()}>
                  Install update
                </Button>
              ) : null}
              {payload.releaseUrl ? (
                <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" asChild>
                  <a href={payload.releaseUrl} target="_blank" rel="noopener noreferrer">
                    View release
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full text-terminalai-muted sm:ml-auto sm:w-auto"
                onClick={skipUpdate}
              >
                Skip for now
              </Button>
            </div>
            {!payload.installSupported ? (
              <p className="text-2xs text-terminalai-muted">
                To enable in-app install, set{' '}
                <code className="rounded bg-terminalai-overlay px-1 py-0.5">UPDATE_INSTALL_ALLOW=1</code>{' '}
                and <code className="rounded bg-terminalai-overlay px-1 py-0.5">UPDATE_INSTALL_COMMAND</code>{' '}
                on the server (see <code className="rounded bg-terminalai-overlay px-1 py-0.5">.env.example</code>
                ).
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === 'installing' ? (
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-terminalai-accent" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium">Installing update</p>
              <p className="mt-0.5 text-2xs text-terminalai-muted">
                Running the configured update command. This may take a few minutes.
              </p>
            </div>
          </div>
        ) : null}

        {phase === 'after_install' && installOutcome ? (
          <div className="flex flex-col gap-3">
            {installOutcome.ok ? (
              <>
                <p className="text-sm font-medium">Update finished</p>
                <p className="text-2xs text-terminalai-muted">
                  Restart the app (or refresh and restart the dev server) so the new version loads.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-terminalai-danger">Install failed</p>
                <pre className="max-h-32 overflow-auto rounded-md border border-terminalai-border bg-terminalai-base p-2 text-2xs text-terminalai-muted whitespace-pre-wrap">
                  {installOutcome.output || 'Unknown error'}
                </pre>
              </>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {installOutcome.ok ? (
                <Button type="button" size="sm" onClick={() => setPhase('ready')}>
                  Continue
                </Button>
              ) : (
                <>
                  <Button type="button" size="sm" onClick={() => setPhase('update')}>
                    Back
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void runInstall()}>
                    Retry
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-terminalai-muted" onClick={skipUpdate}>
                    Skip for now
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
