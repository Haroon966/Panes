import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { PROVIDER_LABELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';
import { useSettingsStore } from '@/store/settingsStore';
import { getMergedStaticModels, type ModelsApiResponse } from '@/utils/localModelDiscovery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Props = {
  catalog: ModelsApiResponse | null;
  onManageKeys: () => void;
};

const ORDER: ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'groq',
  'mistral',
  'ollama',
  'lmstudio',
  'custom',
];

const KEY_PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'mistral'] as const;
type KeyProviderId = (typeof KEY_PROVIDERS)[number];

function isKeyProvider(p: ProviderId): p is KeyProviderId {
  return (KEY_PROVIDERS as readonly ProviderId[]).includes(p);
}

function isProviderConfigured(
  p: ProviderId,
  catalog: ModelsApiResponse | null,
  keyPresence: Record<ProviderId, boolean>,
  customBaseUrl: string
): boolean {
  if (isKeyProvider(p)) return !!keyPresence[p];
  if (p === 'custom') return !!keyPresence.custom && customBaseUrl.trim().length > 0;
  if (p === 'ollama')
    return (
      !!catalog?.local.ollamaReachable && (catalog.local.ollama?.length ?? 0) > 0
    );
  if (p === 'lmstudio')
    return (
      !!catalog?.local.lmstudioReachable && (catalog.local.lmstudio?.length ?? 0) > 0
    );
  return false;
}

export function ModelDropdown({ catalog, onManageKeys }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Partial<Record<ProviderId, boolean>>>({});

  const selectedProvider = useSettingsStore((s) => s.selectedProvider);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSelected = useSettingsStore((s) => s.setSelected);
  const keyPresence = useSettingsStore((s) => s.keyPresence);
  const customBaseUrl = useSettingsStore((s) => s.customBaseUrl);

  const mergedStatic = useMemo(() => getMergedStaticModels(catalog), [catalog]);

  const selectedConfigured = useMemo(
    () =>
      isProviderConfigured(selectedProvider, catalog, keyPresence, customBaseUrl),
    [selectedProvider, catalog, keyPresence, customBaseUrl]
  );

  const visibleProviders = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const statusMatches = (text: string) => text.toLowerCase().includes(qq);

    const filtered = !qq
      ? [...ORDER]
      : ORDER.filter((p) => {
          if (PROVIDER_LABELS[p].toLowerCase().includes(qq)) return true;

          const configured = isProviderConfigured(p, catalog, keyPresence, customBaseUrl);

          if (isKeyProvider(p)) {
            if (!configured && statusMatches('No API configured')) return true;
            if (configured) {
              const models = mergedStatic[p];
              if (models.some((m: string) => m.toLowerCase().includes(qq))) return true;
            }
            return false;
          }

          if (p === 'custom') {
            if (!configured && statusMatches('No API configured')) return true;
            if (configured) {
              const models = mergedStatic.custom;
              if (models.some((m: string) => m.toLowerCase().includes(qq))) return true;
            }
            return false;
          }

          if (p === 'ollama') {
            if (catalog === null) return statusMatches('Loading local models');
            if (!catalog.local.ollamaReachable) return statusMatches('Server not reachable');
            if (catalog.local.ollama.length === 0) return statusMatches('No models installed');
            return catalog.local.ollama.some((m) => m.toLowerCase().includes(qq));
          }

          if (p === 'lmstudio') {
            if (catalog === null) return statusMatches('Loading local models');
            if (!catalog.local.lmstudioReachable) return statusMatches('Server not reachable');
            if (catalog.local.lmstudio.length === 0) return statusMatches('No models installed');
            return catalog.local.lmstudio.some((m) => m.toLowerCase().includes(qq));
          }

          return false;
        });

    filtered.sort((a, b) => {
      const ca = isProviderConfigured(a, catalog, keyPresence, customBaseUrl);
      const cb = isProviderConfigured(b, catalog, keyPresence, customBaseUrl);
      if (ca !== cb) return ca ? -1 : 1;
      return ORDER.indexOf(a) - ORDER.indexOf(b);
    });

    return filtered;
    }, [q, catalog, keyPresence, customBaseUrl, mergedStatic]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setExpanded({});
        setOpen(next);
        if (!next) setQ('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="max-w-[240px] justify-between gap-1.5 rounded-lg border-terminalai-border bg-terminalai-elevated px-2.5 py-1.5 font-medium text-terminalai-text hover:border-terminalai-accent hover:bg-terminalai-hover"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedConfigured && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-terminalai-success shadow-[0_0_6px_rgba(34,197,94,0.55)]"
                aria-hidden
              />
            )}
            <span className="min-w-0 truncate text-[11px]">
              {selectedConfigured ? (
                <>
                  <span className="font-medium">{selectedModel}</span>
                  <span className="ml-1 rounded bg-[rgba(124,106,247,0.15)] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-terminalai-accentText">
                    {PROVIDER_LABELS[selectedProvider]}
                  </span>
                </>
              ) : (
                <span>{PROVIDER_LABELS[selectedProvider]}</span>
              )}
            </span>
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-terminalai-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 border-terminalai-borderBright bg-terminalai-elevated p-0 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-black/40"
        sideOffset={6}
      >
        <div className="flex items-center gap-2 border-b border-terminalai-border px-2 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-terminalai-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter models…"
            className="h-7 border-0 bg-transparent px-0 text-xs text-terminalai-text shadow-none placeholder:text-terminalai-muted focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="py-1 pr-2">
            {visibleProviders.map((p) => {
              const configured = isProviderConfigured(p, catalog, keyPresence, customBaseUrl);
              const openSection = expanded[p] ?? false;

              let body: ReactNode = null;

              if (isKeyProvider(p)) {
                if (!configured) {
                  body = (
                    <div className="space-y-2 px-2 pb-2 pt-0.5">
                      <p className="text-xs text-terminalai-muted">No API configured</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          onManageKeys();
                          setOpen(false);
                        }}
                      >
                        Add API key…
                      </Button>
                    </div>
                  );
                } else {
                  const models = mergedStatic[p];
                  body = (
                    <div className="space-y-0.5 px-2 pb-2 pt-0.5">
                      {models.map((m) => (
                        <button
                          key={`${p}-${m}`}
                          type="button"
                          onClick={() => {
                            setSelected(p, m);
                            setOpen(false);
                          }}
                          className="block w-full truncate rounded px-2 py-1 text-left text-[11.5px] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  );
                }
              } else if (p === 'custom') {
                if (!configured) {
                  body = (
                    <div className="space-y-2 px-2 pb-2 pt-0.5">
                      <p className="text-xs text-terminalai-muted">No API configured</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          onManageKeys();
                          setOpen(false);
                        }}
                      >
                        Add base URL and key…
                      </Button>
                    </div>
                  );
                } else {
                  const models = mergedStatic.custom;
                  body = (
                    <div className="space-y-0.5 px-2 pb-2 pt-0.5">
                      {models.map((m) => (
                        <button
                          key={`custom-${m}`}
                          type="button"
                          onClick={() => {
                            setSelected('custom', m);
                            setOpen(false);
                          }}
                          className="block w-full truncate rounded px-2 py-1 text-left text-[11.5px] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  );
                }
              } else if (p === 'ollama') {
                if (catalog === null) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      Loading local models…
                    </p>
                  );
                } else if (!catalog.local.ollamaReachable) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      Server not reachable
                    </p>
                  );
                } else if (catalog.local.ollama.length === 0) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      No models installed
                    </p>
                  );
                } else {
                  body = (
                    <div className="space-y-0.5 px-2 pb-2 pt-0.5">
                      {catalog.local.ollama.map((m) => (
                        <button
                          key={`ollama-${m}`}
                          type="button"
                          onClick={() => {
                            setSelected('ollama', m);
                            setOpen(false);
                          }}
                          className="block w-full truncate rounded px-2 py-1 text-left text-[11.5px] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  );
                }
              } else if (p === 'lmstudio') {
                if (catalog === null) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      Loading local models…
                    </p>
                  );
                } else if (!catalog.local.lmstudioReachable) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      Server not reachable
                    </p>
                  );
                } else if (catalog.local.lmstudio.length === 0) {
                  body = (
                    <p className="px-2 pb-2 pt-0.5 text-xs text-terminalai-muted">
                      No models installed
                    </p>
                  );
                } else {
                  body = (
                    <div className="space-y-0.5 px-2 pb-2 pt-0.5">
                      {catalog.local.lmstudio.map((m) => (
                        <button
                          key={`lm-${m}`}
                          type="button"
                          onClick={() => {
                            setSelected('lmstudio', m);
                            setOpen(false);
                          }}
                          className="block w-full truncate rounded px-2 py-1 text-left text-[11.5px] text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  );
                }
              }

              return (
                <div key={p} className="border-b border-terminalai-borderSubtle px-2 last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 py-2 text-left"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [p]: !openSection,
                      }))
                    }
                  >
                    {configured ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-terminalai-success"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-terminalai-mutedDeep/50"
                        aria-hidden
                      />
                    )}
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-terminalai-mutedDeep">
                      {PROVIDER_LABELS[p]}
                    </span>
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-terminalai-mutedDeep transition-transform',
                        openSection && 'rotate-90'
                      )}
                    />
                  </button>
                  {openSection && body}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-start rounded-none border-t border-terminalai-border px-2 py-2 text-xs font-normal text-terminalai-accentText hover:bg-terminalai-hover"
          onClick={() => {
            onManageKeys();
            setOpen(false);
          }}
        >
          Manage API keys…
        </Button>
      </PopoverContent>
    </Popover>
  );
}
