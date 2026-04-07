import { useEffect, useState } from 'react';
import { PROVIDER_LABELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';
import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
} from '@/lib/codeFontSize';
import type { PrefsColorScheme } from '@/lib/persistenceApi';
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
import { Textarea } from '@/components/ui/textarea';

const KEY_PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'google', 'groq', 'mistral'];

export function ApiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setApiKeyLocal = useSettingsStore((s) => s.setApiKeyLocal);
  const setCustomBaseUrl = useSettingsStore((s) => s.setCustomBaseUrl);
  const setAgentVerifyCommand = useSettingsStore((s) => s.setAgentVerifyCommand);
  const keyPresence = useSettingsStore((s) => s.keyPresence);
  const setSelected = useSettingsStore((s) => s.setSelected);

  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({});
  const [customBase, setCustomBase] = useState('');
  const [customKey, setCustomKey] = useState('');
  /** Avoid wiping a stored custom key when saving base URL/model without touching the key field. */
  const [customKeyTouched, setCustomKeyTouched] = useState(false);
  const [customModel, setCustomModel] = useState('gpt-4o-mini');
  const workspaceRoot = useSettingsStore((s) => s.workspaceRoot);
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const setColorScheme = useSettingsStore((s) => s.setColorScheme);
  const codeFontSizePx = useSettingsStore((s) => s.codeFontSizePx);
  const setCodeFontSizePx = useSettingsStore((s) => s.setCodeFontSizePx);
  const agentVerbosity = useSettingsStore((s) => s.agentVerbosity);
  const setAgentVerbosity = useSettingsStore((s) => s.setAgentVerbosity);
  const agentContextHints = useSettingsStore((s) => s.agentContextHints);
  const setAgentContextHints = useSettingsStore((s) => s.setAgentContextHints);
  const agentAutoMode = useSettingsStore((s) => s.agentAutoMode);
  const setAgentAutoMode = useSettingsStore((s) => s.setAgentAutoMode);
  const agentPinnedPaths = useSettingsStore((s) => s.agentPinnedPaths);
  const removeAgentPinnedPath = useSettingsStore((s) => s.removeAgentPinnedPath);
  const workspaceFormatOnSave = useSettingsStore((s) => s.workspaceFormatOnSave);
  const setWorkspaceFormatOnSave = useSettingsStore((s) => s.setWorkspaceFormatOnSave);
  const [verifyCommandDraft, setVerifyCommandDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    const s = useSettingsStore.getState();
    setCustomBase(s.customBaseUrl);
    setVerifyCommandDraft(s.agentVerifyCommand);
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

  const saveVerifyCommand = async () => {
    setAgentVerifyCommand(verifyCommandDraft);
    try {
      await flushAppPrefsToServer();
    } catch {
      /* offline */
    }
  };

  const saveAppearance = async (next: PrefsColorScheme) => {
    setColorScheme(next);
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
            <Label className="text-xs text-muted-foreground">Appearance</Label>
            <p className="text-2xs text-muted-foreground">
              Applies to the app shell, workspace editor, and integrated terminal. Saved in SQLite with
              other preferences.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'dark' as const, label: 'Dark' },
                  { id: 'light' as const, label: 'Light' },
                  { id: 'system' as const, label: 'System' },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={colorScheme === id ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => void saveAppearance(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="code-font-size">
                Code font size (editor &amp; terminal)
              </Label>
              <p className="text-2xs text-muted-foreground">
                {CODE_FONT_SIZE_MIN}–{CODE_FONT_SIZE_MAX}px. Adjusts Monaco and xterm together.
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="code-font-size"
                  type="range"
                  min={CODE_FONT_SIZE_MIN}
                  max={CODE_FONT_SIZE_MAX}
                  step={1}
                  value={codeFontSizePx}
                  onChange={(e) => setCodeFontSizePx(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-terminalai-accent"
                  aria-valuemin={CODE_FONT_SIZE_MIN}
                  aria-valuemax={CODE_FONT_SIZE_MAX}
                  aria-valuenow={codeFontSizePx}
                  aria-label="Code font size in pixels"
                />
                <span className="w-10 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {codeFontSizePx}px
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Workspace editor</Label>
              <p className="text-2xs text-muted-foreground">
                When enabled, manual save (Ctrl+S / Save) runs Monaco&apos;s built-in formatter first if the
                language supports it. The 30s auto-save does not format.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={workspaceFormatOnSave ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => {
                    setWorkspaceFormatOnSave(true);
                    void flushAppPrefsToServer();
                  }}
                >
                  Format on manual save: On
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!workspaceFormatOnSave ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => {
                    setWorkspaceFormatOnSave(false);
                    void flushAppPrefsToServer();
                  }}
                >
                  Off
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Agent behavior</Label>
              <p className="text-2xs text-muted-foreground">
                Verbosity and hints are saved in SQLite and appended to the agent system prompt on the
                next agent request (LangGraph).
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'concise' as const, label: 'Concise' },
                    { id: 'detailed' as const, label: 'Detailed' },
                    { id: 'step_by_step' as const, label: 'Step-by-step' },
                  ] as const
                ).map(({ id, label }) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={agentVerbosity === id ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => setAgentVerbosity(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Label className="mt-3 text-xs text-muted-foreground">Mutations</Label>
              <p className="text-2xs text-muted-foreground">
                Auto follows server env only (
                <code className="text-2xs">AGENT_REQUIRE_APPROVAL_*</code>). Confirm always asks before
                writes, patches, deletes, copies, moves, and workspace shell commands.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={agentAutoMode ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => setAgentAutoMode(true)}
                >
                  Auto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!agentAutoMode ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => setAgentAutoMode(false)}
                >
                  Confirm file &amp; shell
                </Button>
              </div>
              <Label className="mt-1 text-xs text-muted-foreground" htmlFor="agent-context-hints">
                Project hints (optional)
              </Label>
              <Textarea
                id="agent-context-hints"
                rows={4}
                maxLength={4000}
                placeholder="Stack (e.g. TypeScript strict, Vitest), repo conventions, default branch, how you run tests if it is non-obvious. The agent sees this every turn (use pinned files for long references)."
                value={agentContextHints}
                onChange={(e) => setAgentContextHints(e.target.value)}
                className="font-mono text-xs"
                aria-describedby="agent-context-hints-help"
              />
              <p id="agent-context-hints-help" className="text-2xs text-muted-foreground">
                {agentContextHints.length}/4000 characters
              </p>
              <Label className="mt-3 text-xs text-muted-foreground">
                Pinned files (agent context)
              </Label>
              <p className="text-2xs text-muted-foreground">
                Up to eight workspace-relative paths. Each run, the server reads these files (within the
                workspace sandbox) and appends a snapshot block to the agent system prompt. Pin or unpin from
                the workspace editor toolbar.
              </p>
              {agentPinnedPaths.length === 0 ? (
                <p className="text-2xs italic text-muted-foreground">No pinned files.</p>
              ) : (
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-terminalai-border p-2">
                  {agentPinnedPaths.map((p) => (
                    <li
                      key={p}
                      className="flex items-center justify-between gap-2 font-mono text-2xs text-terminalai-text"
                    >
                      <span className="min-w-0 truncate" title={p}>
                        {p}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => removeAgentPinnedPath(p)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Working directory (from terminal)</Label>
            <p className="text-2xs text-muted-foreground">
              Saved in SQLite and restored on reload. It updates when you run commands in the focused
              terminal (Fish/bash integration emits a private OSC after each command). Use{' '}
              <code className="text-2xs">cd</code> to change it — it is not editable here. New terminal
              tabs start here when the path still exists. With a connected shell, the agent still prefers
              live PTY cwd on Linux via <code className="text-2xs">/proc</code>. If nothing is saved yet,
              the server uses <code className="text-2xs">AGENT_WORKSPACE_ROOT</code> or the API process
              cwd as fallback when the shell is disconnected.
            </p>
            <Input
              readOnly
              className="font-mono text-sm opacity-90"
              placeholder="(run a command in the terminal to capture cwd)"
              value={workspaceRoot}
              aria-label="Persisted working directory from terminal"
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Agent verify command</Label>
            <p className="text-2xs text-muted-foreground">
              Optional. One shell command the agent can run via <code className="text-2xs">run_project_verify_command</code>{' '}
              after edits (same rules as integrated shell: <code className="text-2xs">AGENT_ALLOW_SHELL=1</code>, optional
              approval). Example: <code className="text-2xs">npm test</code> or <code className="text-2xs">npm run lint</code>.
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1 font-mono text-sm"
                placeholder="npm test"
                value={verifyCommandDraft}
                onChange={(e) => setVerifyCommandDraft(e.target.value)}
              />
              <Button type="button" size="sm" variant="default" onClick={() => void saveVerifyCommand()}>
                Save
              </Button>
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
