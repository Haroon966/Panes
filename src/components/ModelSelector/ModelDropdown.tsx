import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_STATIC_MODELS, PROVIDER_LABELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';
import { useSettingsStore } from '@/store/settingsStore';
import type { ModelsApiResponse } from '@/utils/localModelDiscovery';

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

export function ModelDropdown({ catalog, onManageKeys }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selectedProvider = useSettingsStore((s) => s.selectedProvider);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSelected = useSettingsStore((s) => s.setSelected);

  const groups = useMemo(() => {
    const localOllama = catalog?.local.ollama ?? [];
    const localLm = catalog?.local.lmstudio ?? [];
    const staticPart = DEFAULT_STATIC_MODELS;
    const list: { provider: ProviderId; models: string[]; dot?: boolean }[] = [];
    for (const p of ORDER) {
      if (p === 'ollama') {
        list.push({
          provider: 'ollama',
          models: localOllama.length ? localOllama : ['(start Ollama — no models detected)'],
          dot: catalog?.local.ollamaReachable,
        });
        continue;
      }
      if (p === 'lmstudio') {
        list.push({
          provider: 'lmstudio',
          models: localLm.length ? localLm : ['(start LM Studio server — no models)'],
          dot: catalog?.local.lmstudioReachable,
        });
        continue;
      }
      if (p === 'custom') {
        list.push({ provider: 'custom', models: staticPart.custom });
        continue;
      }
      list.push({
        provider: p,
        models: staticPart[p as keyof typeof staticPart] as string[],
      });
    }
    return list;
  }, [catalog]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return groups;
    return groups
      .map((g) => ({
        ...g,
        models: g.models.filter((m) => m.toLowerCase().includes(qq)),
      }))
      .filter((g) => g.models.length > 0);
  }, [groups, q]);

  const label = `${PROVIDER_LABELS[selectedProvider]} · ${selectedModel}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[220px] items-center gap-1 truncate rounded border border-terminalai-border bg-terminalai-bg px-2 py-1 text-xs text-terminalai-text hover:border-terminalai-accent"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 max-h-80 overflow-hidden rounded border border-terminalai-border bg-terminalai-chat shadow-xl">
          <div className="flex items-center gap-1 border-b border-terminalai-border p-2">
            <Search className="h-3 w-3 text-terminalai-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter models…"
              className="flex-1 bg-transparent text-xs text-terminalai-text outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((g) => (
              <div key={g.provider} className="px-2 py-1">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-terminalai-muted">
                  {g.dot && <span className="h-1.5 w-1.5 rounded-full bg-terminalai-success" />}
                  {PROVIDER_LABELS[g.provider]}
                </div>
                {g.models.map((m) => (
                  <button
                    key={`${g.provider}-${m}`}
                    type="button"
                    disabled={m.startsWith('(')}
                    onClick={() => {
                      setSelected(g.provider, m);
                      setOpen(false);
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left text-xs text-terminalai-text hover:bg-terminalai-border/40 disabled:opacity-40"
                  >
                    {m}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onManageKeys();
              setOpen(false);
            }}
            className="w-full border-t border-terminalai-border px-2 py-2 text-left text-xs text-terminalai-accent hover:bg-terminalai-border/30"
          >
            Manage API keys…
          </button>
        </div>
      )}
    </div>
  );
}
