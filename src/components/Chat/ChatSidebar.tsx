import { Settings, Square } from 'lucide-react';
import { useState } from 'react';
import { AgentCore } from '@/components/Agent/AgentCore';
import { ApiKeyModal } from '@/components/ModelSelector/ApiKeyModal';
import { ModelDropdown } from '@/components/ModelSelector/ModelDropdown';
import { useChatStream } from '@/hooks/useChatStream';
import { useLocalModels } from '@/hooks/useLocalModels';
import { useChatStore } from '@/store/chatStore';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

export function ChatSidebar() {
  const messages = useChatStore((s) => s.messages);
  const [keysOpen, setKeysOpen] = useState(false);
  const catalog = useLocalModels(30000);
  const { isStreaming, abortStream } = useChatStream();

  return (
    <>
      <div className="flex h-full min-h-0 w-[450px] shrink-0 flex-col bg-terminalai-chat">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-terminalai-border px-3 py-2">
          <span className="text-sm font-semibold text-terminalai-text">TerminalAI</span>
          <ModelDropdown catalog={catalog} onManageKeys={() => setKeysOpen(true)} />
          <AgentCore />
          <button
            type="button"
            title="Settings / API keys"
            onClick={() => setKeysOpen(true)}
            className="ml-auto rounded p-1.5 text-terminalai-muted hover:bg-terminalai-border/40 hover:text-terminalai-text"
          >
            <Settings className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-terminalai-muted">
              Ask about terminal output, errors, or shell commands. Click orange underlines in the
              terminal to attach errors.
            </p>
          )}
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-terminalai-muted">
              <span className="animate-pulse">Responding…</span>
              <button
                type="button"
                onClick={abortStream}
                className="flex items-center gap-1 rounded border border-terminalai-border px-2 py-0.5 hover:bg-terminalai-border/40"
              >
                <Square className="h-3 w-3" />
                Stop
              </button>
            </div>
          )}
        </div>
        <ChatInput />
      </div>
      <ApiKeyModal open={keysOpen} onClose={() => setKeysOpen(false)} />
    </>
  );
}
