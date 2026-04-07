import { ArrowUp, Paperclip } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ErrorReference } from './ErrorReference';

export function ChatInput({ onManageKeys }: { onManageKeys: () => void }) {
  const input = useChatStore((s) => s.input);
  const setInput = useChatStore((s) => s.setInput);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const showManageKeysCallout = useChatStore((s) => s.showManageKeysCallout);
  const focusNonce = useChatStore((s) => s.focusChatNonce);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ta.current?.focus();
  }, [focusNonce]);

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

  return (
    <div className="shrink-0 border-t border-terminalai-border bg-terminalai-surface px-3.5 pb-3 pt-2.5">
      <ErrorReference />
      {showManageKeysCallout && (
        <div
          className="mb-2.5 flex flex-col gap-2 rounded-lg border border-terminalai-warning/45 bg-terminalai-warning/10 px-3 py-2.5"
          role="status"
        >
          <p className="text-[12px] leading-snug text-terminalai-text">
            This model needs a valid API key or provider settings before chat can run.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 w-fit bg-terminalai-accent text-xs font-semibold text-white hover:bg-terminalai-accent/90 max-[899px]:h-10 max-[899px]:min-h-[44px] max-[899px]:px-4"
            onClick={onManageKeys}
          >
            Manage API keys
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-terminalai-border bg-terminalai-elevated transition-[border-color,box-shadow] focus-within:border-terminalai-accent focus-within:shadow-[0_0_0_2px_hsl(var(--ring)_/_0.35)]">
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
          aria-label="Chat message"
          className="max-h-[120px] min-h-[40px] resize-none border-0 bg-transparent px-3 py-2.5 pb-1 text-[12.5px] leading-relaxed text-terminalai-text placeholder:text-terminalai-mutedDeep focus-visible:ring-0 max-[899px]:min-h-[44px]"
        />
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-[26px] w-[26px] shrink-0 rounded-md text-terminalai-mutedDeep hover:bg-terminalai-hover hover:text-terminalai-muted max-[899px]:h-11 max-[899px]:w-11 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
            title="Attach error from terminal (use link in terminal output)"
            disabled
            aria-label="Attach error from terminal (coming soon)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto h-7 gap-1.5 rounded-md bg-terminalai-accent px-3 text-[11px] font-semibold text-white shadow-none hover:bg-terminalai-accent/90 hover:shadow-[0_4px_12px_rgba(124,106,247,0.35)] max-[899px]:h-10 max-[899px]:min-h-[44px] max-[899px]:px-4 max-[899px]:text-xs"
            onClick={() => void handleSend()}
            disabled={isStreaming || !input.trim()}
            title="Send (Enter)"
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
