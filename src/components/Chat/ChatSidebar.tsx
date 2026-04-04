import { History, MessageSquarePlus, PanelLeftClose, Search, Settings, Square, Trash2 } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyModal } from '@/components/ModelSelector/ApiKeyModal';
import { ModelDropdown } from '@/components/ModelSelector/ModelDropdown';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConversationRow } from '@/lib/persistenceApi';
import { useChatStream } from '@/hooks/useChatStream';
import type { ModelsApiResponse } from '@/utils/localModelDiscovery';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { cn } from '@/lib/utils';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { HitlApprovalPanel } from './HitlApprovalPanel';

function ChatHistoryColumn({
  historyFilter,
  setHistoryFilter,
  onOpenSettings,
}: {
  historyFilter: string;
  setHistoryFilter: (v: string) => void;
  onOpenSettings: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const newChat = useChatStore((s) => s.newChat);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const [deleteTarget, setDeleteTarget] = useState<ConversationRow | null>(null);
  const historyListScrollRef = useRef<HTMLDivElement>(null);
  const prevConversationCount = useRef(0);

  const filtered = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, historyFilter]);

  useLayoutEffect(() => {
    const el = historyListScrollRef.current;
    if (!el) return;
    const n = conversations.length;
    if (n === 0) {
      prevConversationCount.current = 0;
      return;
    }
    const firstFill = prevConversationCount.current === 0 && n > 0;
    prevConversationCount.current = n;
    if (!firstFill) return;
    el.scrollTop = el.scrollHeight;
  }, [conversations]);

  return (
    <aside
      className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-terminalai-border bg-terminalai-surface md:w-[220px]"
      aria-label="Chat history"
    >
      <div className="shrink-0 border-b border-terminalai-borderSubtle px-3.5 pb-2.5 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-terminalai-accent to-[#c084fc] font-mono text-[11px] font-bold text-white shadow-[0_0_12px_rgba(124,106,247,0.25)]">
            T
          </div>
          <div className="min-w-0 text-[13px] font-semibold tracking-wide text-terminalai-text">
            Terminal<span className="text-terminalai-accentText">AI</span>
          </div>
        </div>
      </div>
      <div className="mx-2.5 mt-2.5 flex shrink-0 items-stretch gap-1.5">
        <label className="flex min-w-0 flex-1 cursor-text items-center gap-1.5 rounded-lg border border-terminalai-border bg-terminalai-elevated px-2.5 py-1.5 text-[11px] text-terminalai-mutedDeep transition-colors hover:border-terminalai-borderBright">
          <Search className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <Input
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            placeholder="Search history…"
            className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 text-[11px] text-terminalai-text shadow-none placeholder:text-terminalai-mutedDeep focus-visible:ring-0"
          />
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg border-terminalai-border bg-terminalai-elevated text-terminalai-muted hover:border-terminalai-borderBright hover:bg-terminalai-hover hover:text-terminalai-accentText"
              onClick={() => void newChat()}
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>
      <div className="px-3.5 pb-1 pt-2.5 text-2xs font-semibold uppercase tracking-[0.1em] text-terminalai-mutedDeep">
        Chats
      </div>
      <div
        ref={historyListScrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
      >
        {filtered.length === 0 ? (
          <p className="px-1 py-1 text-[11px] leading-snug text-terminalai-muted">
            {conversations.length === 0 ? 'No saved chats yet.' : 'No matches.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((c) => {
              const active = c.id === activeConversationId;
              const title = c.title?.trim() || 'Untitled chat';
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      'flex min-w-0 items-stretch gap-0.5 rounded-lg transition-colors',
                      active
                        ? 'border border-[rgba(124,106,247,0.2)] bg-[rgba(124,106,247,0.15)]'
                        : 'border border-transparent hover:bg-terminalai-hover'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void selectConversation(c.id)}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 text-left"
                    >
                      <span className="line-clamp-2 text-xs font-medium text-terminalai-text">
                        {title}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-terminalai-mutedDeep">
                        <span
                          className={cn(
                            'h-1 w-1 shrink-0 rounded-full bg-terminalai-accent',
                            active && 'bg-terminalai-success'
                          )}
                          aria-hidden
                        />
                        Saved
                      </span>
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="my-1 mr-1 h-7 w-7 shrink-0 rounded-md text-terminalai-muted opacity-70 hover:bg-terminalai-overlay hover:text-destructive hover:opacity-100"
                          aria-label={`Delete “${title}”`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget(c);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Delete chat</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="shrink-0 border-t border-terminalai-borderSubtle p-2.5">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-terminalai-muted transition-colors hover:bg-terminalai-hover hover:text-terminalai-text"
        >
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Settings
        </button>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-terminalai-border bg-terminalai-elevated text-terminalai-text ring-terminalai-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-terminalai-text">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-terminalai-muted">
              This removes “{deleteTarget?.title?.trim() || 'Untitled chat'}” and all of its messages
              from your history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-terminalai-borderSubtle bg-terminalai-surface">
            <AlertDialogCancel className="border-terminalai-border bg-terminalai-elevated text-terminalai-text hover:bg-terminalai-hover">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive/15 text-destructive hover:bg-destructive/25"
              onClick={() => {
                const id = deleteTarget?.id;
                if (id) void deleteConversation(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function ChatbotColumn({
  catalog,
  onManageKeys,
}: {
  catalog: ModelsApiResponse | null;
  onManageKeys: () => void;
}) {
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useSettingsStore((s) => s.setHistoryPanelOpen);
  const messages = useChatStore((s) => s.messages);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const newChat = useChatStore((s) => s.newChat);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const { isStreaming, abortStream } = useChatStream();
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeConversationId]);

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col border-terminalai-border bg-terminalai-surface',
        historyPanelOpen
          ? 'md:w-[450px] md:min-w-[300px] md:flex-none'
          : 'md:min-w-[300px] md:flex-1'
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-terminalai-border px-3.5 py-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 shrink-0 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
              aria-label={historyPanelOpen ? 'Hide history panel' : 'Show history panel'}
              aria-pressed={historyPanelOpen}
              onClick={() => setHistoryPanelOpen(!historyPanelOpen)}
            >
              {historyPanelOpen ? (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              ) : (
                <History className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {historyPanelOpen ? 'Hide history panel' : 'Show history panel'}
          </TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ModelDropdown catalog={catalog} onManageKeys={onManageKeys} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                onClick={() => void clearMessages()}
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                onClick={onManageKeys}
                aria-label="Settings / API keys"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings / API keys</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-accentText"
                onClick={() => void newChat()}
                aria-label="New chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3.5"
      >
        {messages.length === 0 && (
          <p className="text-[12.5px] leading-relaxed text-terminalai-muted">
            Ask about terminal output, errors, or shell commands. Click orange underlines in the
            terminal to attach errors.
          </p>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isStreaming && (
          <div className="flex w-fit items-center gap-2 rounded-lg rounded-bl-sm border border-terminalai-border bg-terminalai-elevated px-3 py-2.5">
            <span className="flex gap-1">
              <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:200ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:400ms]" />
            </span>
            <span className="text-2xs text-terminalai-muted">Responding…</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="ml-1 h-6 gap-1 border-terminalai-border bg-terminalai-overlay text-2xs"
                  onClick={abortStream}
                >
                  <Square className="h-3 w-3" />
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Stop generation</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      <HitlApprovalPanel />
      <ChatInput />
    </div>
  );
}

export function ChatSidebar({ catalog }: { catalog: ModelsApiResponse | null }) {
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const [historyFilter, setHistoryFilter] = useState('');
  const [keysOpen, setKeysOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-terminalai-surface md:flex-row">
      {historyPanelOpen && (
        <ChatHistoryColumn
          historyFilter={historyFilter}
          setHistoryFilter={setHistoryFilter}
          onOpenSettings={() => setKeysOpen(true)}
        />
      )}
      <ChatbotColumn catalog={catalog} onManageKeys={() => setKeysOpen(true)} />
      <ApiKeyModal open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}
