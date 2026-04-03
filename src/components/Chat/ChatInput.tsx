import { ArrowUp, Paperclip } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { ErrorReference } from './ErrorReference';

export function ChatInput() {
  const input = useChatStore((s) => s.input);
  const setInput = useChatStore((s) => s.setInput);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
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
    <div className="border-t border-terminalai-border bg-terminalai-chat p-3">
      <ErrorReference />
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="shrink-0 rounded p-2 text-terminalai-muted hover:bg-terminalai-border/40 hover:text-terminalai-text"
          title="Attach error from terminal (use link in terminal output)"
          disabled
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
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
          className="max-h-32 min-h-[44px] flex-1 resize-y rounded border border-terminalai-border bg-terminalai-bg px-3 py-2 text-sm text-terminalai-text placeholder:text-terminalai-muted focus:border-terminalai-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isStreaming || !input.trim()}
          className="shrink-0 rounded bg-terminalai-accent p-2 text-terminalai-bg hover:opacity-90 disabled:opacity-40"
          title="Send"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
