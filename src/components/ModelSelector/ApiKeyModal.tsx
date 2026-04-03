import { X } from 'lucide-react';
import { useState } from 'react';
import { PROVIDER_LABELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';
import { useSettingsStore } from '@/store/settingsStore';

const KEY_PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'google', 'groq', 'mistral'];

export function ApiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setCustomBaseUrl = useSettingsStore((s) => s.setCustomBaseUrl);
  const getDecodedKey = useSettingsStore((s) => s.getDecodedKey);
  const getCustomBaseUrl = useSettingsStore((s) => s.getCustomBaseUrl);
  const setSelected = useSettingsStore((s) => s.setSelected);

  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [customBase, setCustomBase] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customModel, setCustomModel] = useState('gpt-4o-mini');

  if (!open) return null;

  const saveProvider = (p: ProviderId) => {
    const v = drafts[p] ?? '';
    setApiKey(p, v);
  };

  const saveCustom = () => {
    setCustomBaseUrl(customBase);
    setApiKey('custom', customKey);
    setSelected('custom', customModel);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-terminalai-border bg-terminalai-chat p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-terminalai-text">API keys</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-terminalai-muted hover:bg-terminalai-border/40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-terminalai-muted">
          Keys are stored in localStorage (base64 obfuscation). See SECURITY.md.
        </p>
        <div className="flex flex-col gap-4">
          {KEY_PROVIDERS.map((p) => (
            <div key={p} className="flex flex-col gap-1">
              <label className="text-xs text-terminalai-muted">{PROVIDER_LABELS[p]}</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="flex-1 rounded border border-terminalai-border bg-terminalai-bg px-2 py-1.5 text-sm text-terminalai-text"
                  placeholder={getDecodedKey(p) ? '••••••••' : 'sk-...'}
                  value={drafts[p] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => saveProvider(p)}
                  className="rounded bg-terminalai-accent px-3 py-1 text-xs text-terminalai-bg"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
          <div className="border-t border-terminalai-border pt-4">
            <h3 className="mb-2 text-sm font-medium text-terminalai-text">Custom provider</h3>
            <label className="text-xs text-terminalai-muted">Base URL</label>
            <input
              className="mb-2 w-full rounded border border-terminalai-border bg-terminalai-bg px-2 py-1.5 text-sm text-terminalai-text"
              placeholder="https://api.example.com/v1"
              defaultValue={getCustomBaseUrl()}
              onChange={(e) => setCustomBase(e.target.value)}
            />
            <label className="text-xs text-terminalai-muted">API key (optional)</label>
            <input
              type="password"
              className="mb-2 w-full rounded border border-terminalai-border bg-terminalai-bg px-2 py-1.5 text-sm text-terminalai-text"
              placeholder="key"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            <label className="text-xs text-terminalai-muted">Model id</label>
            <input
              className="mb-2 w-full rounded border border-terminalai-border bg-terminalai-bg px-2 py-1.5 text-sm text-terminalai-text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
            />
            <button
              type="button"
              onClick={saveCustom}
              className="rounded bg-terminalai-accent px-3 py-1.5 text-sm text-terminalai-bg"
            >
              Save custom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
