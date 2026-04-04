import { ArrowUp, ChevronDown, Paperclip } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { AgentBackend } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ErrorReference } from './ErrorReference';

type ClineOptionsResponse = {
  agents?: string[];
  defaultAgent?: string;
  serverClineBaseConfigured?: boolean;
  upstreamKind?: string;
  resolvedBaseHost?: string;
  suggestedDefaultModel?: string;
};

type ClineModelsResponse = {
  models?: { id: string }[];
  hint?: string | null;
  upstreamKind?: string;
};

export function ChatInput({ onManageKeys }: { onManageKeys: () => void }) {
  const input = useChatStore((s) => s.input);
  const setInput = useChatStore((s) => s.setInput);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const showManageKeysCallout = useChatStore((s) => s.showManageKeysCallout);
  const focusNonce = useChatStore((s) => s.focusChatNonce);
  const ta = useRef<HTMLTextAreaElement>(null);

  const agentBackend = useSettingsStore((s) => s.agentBackend);
  const setAgentBackend = useSettingsStore((s) => s.setAgentBackend);
  const clineAgentId = useSettingsStore((s) => s.clineAgentId);
  const setClineAgentId = useSettingsStore((s) => s.setClineAgentId);
  const setClineServerBaseConfigured = useSettingsStore((s) => s.setClineServerBaseConfigured);
  const clineModel = useSettingsStore((s) => s.clineModel);
  const setClineModel = useSettingsStore((s) => s.setClineModel);
  const clineLocalBaseUrl = useSettingsStore((s) => s.clineLocalBaseUrl);

  const [clineAgents, setClineAgents] = useState<string[]>(['default']);
  const [clineModelOptions, setClineModelOptions] = useState<string[]>([]);
  const [clineModelsHint, setClineModelsHint] = useState<string | null>(null);

  useEffect(() => {
    ta.current?.focus();
  }, [focusNonce]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/agent/cline/options');
        const j = (await r.json()) as ClineOptionsResponse;
        if (cancelled) return;
        setClineServerBaseConfigured(
          typeof j.serverClineBaseConfigured === 'boolean' ? j.serverClineBaseConfigured : null
        );
        const st = useSettingsStore.getState();
        if (
          st.agentBackend === 'cline' &&
          !st.getClineLocalBaseUrl().trim() &&
          j.serverClineBaseConfigured === false
        ) {
          st.setAgentBackend('langchain');
        }
        const ids = j.agents?.length ? [...j.agents] : ['default'];
        const cur = useSettingsStore.getState().clineAgentId;
        if (cur && !ids.includes(cur)) {
          ids.push(cur);
        }
        setClineAgents(ids);
      } catch {
        if (!cancelled) {
          setClineAgents(['default']);
          setClineServerBaseConfigured(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setClineServerBaseConfigured]);

  useEffect(() => {
    if (agentBackend !== 'cline') {
      setClineModelOptions([]);
      setClineModelsHint(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const base = useSettingsStore.getState().getClineLocalBaseUrl().trim();
      const qs = base ? `?clineLocalBaseUrl=${encodeURIComponent(base)}` : '';
      try {
        const r = await fetch(`/api/agent/cline/models${qs}`);
        const j = (await r.json()) as ClineModelsResponse;
        if (cancelled) return;
        setClineModelOptions((j.models ?? []).map((m) => m.id).filter(Boolean));
        setClineModelsHint(typeof j.hint === 'string' && j.hint ? j.hint : null);
      } catch {
        if (!cancelled) {
          setClineModelOptions([]);
          setClineModelsHint('Could not load models');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentBackend, clineLocalBaseUrl]);

  const handleSend = async () => {
    const v = input.trim();
    if (!v || isStreaming) return;

    if (v === '/edit-fish-config') {
      setInput('');
      try {
        const r = await fetch('/api/fish-config');
        const j = (await r.json()) as { content?: string; path?: string; error?: string };
        const block =
          j.content !== undefined
            ? `### Fish config (\`${j.path}\`)\n\n\`\`\`fish\n${j.content}\n\`\`\``
            : `Could not load fish config: ${j.error ?? r.statusText}`;
        useChatStore.setState((s) => ({
          messages: [...s.messages, { id: crypto.randomUUID(), role: 'assistant', content: block }],
        }));
      } catch (e) {
        useChatStore.setState((s) => ({
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Failed to load config: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
        }));
      }
      return;
    }

    await sendMessage();
  };

  const triggerClass =
    'h-[26px] shrink-0 gap-1 rounded-md border border-terminalai-border bg-terminalai-elevated px-2 text-[11px] font-medium text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text';

  return (
    <div className="shrink-0 border-t border-terminalai-border bg-terminalai-surface px-3.5 pb-3 pt-2.5">
      <ErrorReference />
      {showManageKeysCallout && (
        <div
          className="mb-2.5 flex flex-col gap-2 rounded-lg border border-terminalai-borderBright bg-[rgba(245,158,11,0.08)] px-3 py-2.5"
          role="status"
        >
          <p className="text-[12px] leading-snug text-terminalai-text">
            This model needs a valid API key or provider settings before chat can run.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 w-fit bg-terminalai-accent text-xs font-semibold text-white hover:bg-[#6a58e0]"
            onClick={onManageKeys}
          >
            Manage API keys
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-terminalai-border bg-terminalai-elevated transition-colors focus-within:border-terminalai-accent">
        <Textarea
          ref={ta}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type a message… (/edit-fish-config)"
          rows={1}
          className="max-h-[120px] min-h-[40px] resize-none border-0 bg-transparent px-3 py-2.5 pb-1 text-[12.5px] leading-relaxed text-terminalai-text placeholder:text-terminalai-mutedDeep focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={isStreaming}
                className={cn(triggerClass, 'justify-between')}
                aria-label="Agent backend"
              >
                {agentBackend === 'langchain' ? 'TerminalAI' : 'Cline'}
                <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-terminalai-border bg-terminalai-elevated text-terminalai-text"
            >
              <DropdownMenuRadioGroup
                value={agentBackend}
                onValueChange={(v) => setAgentBackend(v as AgentBackend)}
              >
                <DropdownMenuRadioItem
                  value="langchain"
                  className="text-xs focus:bg-terminalai-hover focus:text-terminalai-text"
                >
                  TerminalAI (LangChain)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="cline"
                  className="text-xs focus:bg-terminalai-hover focus:text-terminalai-text"
                >
                  Cline (OpenAI API — Ollama / LM Studio / bridge)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {agentBackend === 'cline' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isStreaming}
                  className={cn(triggerClass, 'max-w-[140px] justify-between')}
                  aria-label="Cline agent profile"
                >
                  <span className="truncate">{clineAgentId || 'default'}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-terminalai-border bg-terminalai-elevated text-terminalai-text"
              >
                <DropdownMenuRadioGroup value={clineAgentId} onValueChange={setClineAgentId}>
                  {clineAgents.map((id) => (
                    <DropdownMenuRadioItem
                      key={id}
                      value={id}
                      className="text-xs focus:bg-terminalai-hover focus:text-terminalai-text"
                    >
                      {id}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {agentBackend === 'cline' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isStreaming}
                  className={cn(triggerClass, 'max-w-[200px] justify-between')}
                  aria-label="Cline model"
                  title={clineModelsHint ?? undefined}
                >
                  <span className="truncate">
                    {clineModel.trim() ? clineModel : 'Cline model: auto'}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 overflow-y-auto border-terminalai-border bg-terminalai-elevated text-terminalai-text"
              >
                <DropdownMenuRadioGroup
                  value={clineModel.trim() ? clineModel : '__auto__'}
                  onValueChange={(v) => setClineModel(v === '__auto__' ? '' : v)}
                >
                  <DropdownMenuRadioItem
                    value="__auto__"
                    className="text-xs focus:bg-terminalai-hover focus:text-terminalai-text"
                  >
                    Auto (server / tags)
                  </DropdownMenuRadioItem>
                  {clineModelOptions.map((id) => (
                    <DropdownMenuRadioItem
                      key={id}
                      value={id}
                      className="text-xs focus:bg-terminalai-hover focus:text-terminalai-text"
                    >
                      {id}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {clineModelsHint && clineModelOptions.length === 0 && (
                  <p className="px-2 py-1.5 text-2xs text-terminalai-muted">{clineModelsHint}</p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-[26px] w-[26px] shrink-0 rounded-md text-terminalai-mutedDeep hover:bg-terminalai-hover hover:text-terminalai-muted"
            title="Attach error from terminal (use link in terminal output)"
            disabled
            aria-label="Attach error from terminal"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-7 gap-1.5 rounded-md bg-terminalai-accent px-3 text-[11px] font-semibold text-white shadow-none hover:bg-[#6a58e0] hover:shadow-[0_4px_12px_rgba(124,106,247,0.35)]"
            onClick={() => void handleSend()}
            disabled={isStreaming || !input.trim()}
            title="Send"
            aria-label="Send message"
          >
            Send
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
