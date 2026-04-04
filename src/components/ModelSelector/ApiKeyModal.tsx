import { useEffect, useState } from 'react';
import { PROVIDER_LABELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';
import { flushAppPrefsToServer } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const KEY_PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'google', 'groq', 'mistral'];

export function ApiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setApiKeyLocal = useSettingsStore((s) => s.setApiKeyLocal);
  const setCustomBaseUrl = useSettingsStore((s) => s.setCustomBaseUrl);
  const setWorkspaceRoot = useSettingsStore((s) => s.setWorkspaceRoot);
  const setClineLocalBaseUrl = useSettingsStore((s) => s.setClineLocalBaseUrl);
  const clineAutoFallbackOnError = useSettingsStore((s) => s.clineAutoFallbackOnError);
  const setClineAutoFallbackOnError = useSettingsStore((s) => s.setClineAutoFallbackOnError);
  const keyPresence = useSettingsStore((s) => s.keyPresence);
  const setSelected = useSettingsStore((s) => s.setSelected);

  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [customBase, setCustomBase] = useState('');
  const [customKey, setCustomKey] = useState('');
  /** Avoid wiping a stored custom key when saving base URL/model without touching the key field. */
  const [customKeyTouched, setCustomKeyTouched] = useState(false);
  const [customModel, setCustomModel] = useState('gpt-4o-mini');
  const [workspaceRootDraft, setWorkspaceRootDraft] = useState('');
  const [clineUrlDraft, setClineUrlDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = useSettingsStore.getState();
    setCustomBase(s.customBaseUrl);
    setWorkspaceRootDraft(s.workspaceRoot);
    setClineUrlDraft(s.clineLocalBaseUrl);
    if (s.selectedProvider === 'custom') {
      setCustomModel(s.selectedModel);
    }
    setCustomKeyTouched(false);
  }, [open]);

  const saveProvider = async (p: ProviderId) => {
    const v = drafts[p] ?? '';
    const has = v.trim().length > 0;
    setApiKeyLocal(p, has);
    try {
      await flushAppPrefsToServer({ [p]: v });
    } catch {
      /* PersistenceProvider banner handles offline */
    }
  };

  const saveCustom = async () => {
    setCustomBaseUrl(customBase);
    setSelected('custom', customModel);
    if (customKeyTouched) {
      const hasCustomKey = customKey.trim().length > 0;
      setApiKeyLocal('custom', hasCustomKey);
      try {
        await flushAppPrefsToServer({ custom: customKey });
      } catch {
        /* offline */
      }
    } else {
      try {
        await flushAppPrefsToServer();
      } catch {
        /* offline */
      }
    }
  };

  const saveWorkspace = async () => {
    setWorkspaceRoot(workspaceRootDraft);
    try {
      await flushAppPrefsToServer();
    } catch {
      /* offline */
    }
  };

  const saveClineUrl = async () => {
    setClineLocalBaseUrl(clineUrlDraft);
    try {
      await flushAppPrefsToServer();
    } catch {
      /* offline */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API keys</DialogTitle>
          <DialogDescription>
            Keys and paths are stored in the app SQLite database on the machine running the API server
            (plaintext on disk, like <code className="text-2xs">.env</code>). See SECURITY.md.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Agent workspace (absolute path)</Label>
            <p className="text-2xs text-muted-foreground">
              Same machine as the API server. While a terminal tab is connected, the agent uses that
              shell&apos;s current directory for file tools and integrated commands. This path is the
              fallback when no terminal is connected or the server cannot read the PTY cwd (writes may
              require approval if <code className="text-2xs">AGENT_REQUIRE_APPROVAL_FOR_WRITES=1</code>).
              Leave empty to fall back to server <code>AGENT_WORKSPACE_ROOT</code> or API process cwd.
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1 font-mono text-sm"
                placeholder="/home/you/projects/my-app"
                value={workspaceRootDraft}
                onChange={(e) => setWorkspaceRootDraft(e.target.value)}
              />
              <Button type="button" size="sm" variant="default" onClick={() => void saveWorkspace()}>
                Save
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Cline local bridge URL</Label>
            <p className="text-2xs text-muted-foreground">
              Optional override (no trailing path). If empty, the API uses <code>OLLAMA_BASE_URL</code> /{' '}
              <code>LMSTUDIO_BASE_URL</code> from server env or the URL saved here in the database. Auth:{' '}
              <code>CLINE_AUTH_TOKEN</code> on the server.
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1 font-mono text-sm"
                placeholder="http://127.0.0.1:11434"
                value={clineUrlDraft}
                onChange={(e) => setClineUrlDraft(e.target.value)}
              />
              <Button type="button" size="sm" variant="default" onClick={() => void saveClineUrl()}>
                Save
              </Button>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <input
                id="cline-auto-fallback"
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-terminalai-border"
                checked={clineAutoFallbackOnError}
                onChange={(e) => setClineAutoFallbackOnError(e.target.checked)}
              />
              <Label htmlFor="cline-auto-fallback" className="text-2xs font-normal text-muted-foreground">
                Auto-switch to TerminalAI (LangChain) when Cline is misconfigured or the bridge is
                unreachable.
              </Label>
            </div>
          </div>
          <Separator />
          {KEY_PROVIDERS.map((p) => (
            <div key={p} className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{PROVIDER_LABELS[p]}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  className="flex-1 text-sm"
                  placeholder={keyPresence[p] ? '••••••••' : 'sk-...'}
                  value={drafts[p] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
                />
                <Button type="button" size="sm" variant="default" onClick={() => void saveProvider(p)}>
                  Save
                </Button>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Custom provider</h3>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Base URL</Label>
              <Input
                className="text-sm"
                placeholder="https://api.example.com/v1"
                value={customBase}
                onChange={(e) => setCustomBase(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">API key (optional)</Label>
              <Input
                type="password"
                className="text-sm"
                placeholder="key"
                value={customKey}
                onChange={(e) => {
                  setCustomKeyTouched(true);
                  setCustomKey(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Model id</Label>
              <Input
                className="text-sm"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void saveCustom()}>
              Save custom
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
