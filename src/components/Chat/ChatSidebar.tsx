import {
  CircleHelp,
  History,
  MessageSquarePlus,
  PanelLeftClose,
  Pencil,
  Search,
  Settings,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { describeAgentLiveActivity, humanizeAgentToolName } from '@/lib/agentActivitySummary';
import type { ConversationRow } from '@/lib/persistenceApi';
import { useAgentStreamInterruptedNotice } from '@/hooks/useAgentStreamInterruptedNotice';
import { useChatStream } from '@/hooks/useChatStream';
import type { ModelsApiResponse } from '@/utils/localModelDiscovery';
import { useChatStore } from '@/store/chatStore';
import { useSettingsStore } from '@/store/settingsStore';
import { cn } from '@/lib/utils';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { HitlApprovalPanel } from './HitlApprovalPanel';

const HISTORY_PREVIEW_COUNT = 8;

function formatCompactTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SessionTokenUsageBadge() {
  const { input, output } = useChatStore((s) => s.sessionTokenUsage);
  if (input === 0 && output === 0) return null;
  return (
    <span
      className="truncate text-2xs text-terminalai-mutedDeep"
      title="Cumulative prompt and completion tokens reported by the TerminalAI agent (LangGraph) this session. Omitted when the provider does not send usage metadata."
    >
      Tokens: {formatCompactTokenCount(input)} in · {formatCompactTokenCount(output)} out
    </span>
  );
}

/** Narrow icon strip when chat history is collapsed: top = logo, new chat, search; bottom = settings, shortcuts. */
function ChatHistoryIconRail({
  onOpenHistory,
  onOpenSettings,
  shortcutsIconTrigger,
}: {
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  shortcutsIconTrigger: ReactNode;
}) {
  const newChat = useChatStore((s) => s.newChat);

  return (
    <aside
      className="flex min-h-0 w-full shrink-0 flex-row items-center justify-between gap-2 border-b border-terminalai-border bg-terminalai-surface px-2 pb-2.5 pt-4 md:h-full md:w-full md:min-w-0 md:flex-col md:items-center md:justify-start md:gap-0 md:border-b-0 md:border-r md:px-1.5 md:py-0"
      aria-label="Chat tools"
    >
      <div className="flex flex-row items-center gap-2 md:w-full md:flex-col md:items-center md:border-b md:border-terminalai-borderSubtle md:gap-2.5 md:px-1.5 md:pb-4 md:pt-6">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-terminalai-accent to-[#c084fc] font-mono text-xs font-bold text-white shadow-[0_0_12px_rgba(124,106,247,0.25)]"
          aria-hidden
        >
          T
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-accentText"
              onClick={() => void newChat()}
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
              onClick={onOpenHistory}
              aria-label="Search chat history"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Search chat history</TooltipContent>
        </Tooltip>
      </div>
      <div className="hidden min-h-0 w-full flex-1 md:block" aria-hidden />
      <div className="flex flex-row items-center gap-1 md:w-full md:flex-col md:items-center md:gap-1.5 md:px-1.5 md:pb-4 md:pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
              onClick={onOpenSettings}
              aria-label="Settings / API keys"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings / API keys</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{shortcutsIconTrigger}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function ChatHistoryColumn({
  historyFilter,
  setHistoryFilter,
  onOpenSettings,
  shortcutsTrigger,
}: {
  historyFilter: string;
  setHistoryFilter: (v: string) => void;
  onOpenSettings: () => void;
  shortcutsTrigger: ReactNode;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const newChat = useChatStore((s) => s.newChat);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const [deleteTarget, setDeleteTarget] = useState<ConversationRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<ConversationRow | null>(null);
  const [renameTitleDraft, setRenameTitleDraft] = useState('');
  const [historyListExpanded, setHistoryListExpanded] = useState(false);
  const historyListScrollRef = useRef<HTMLDivElement>(null);
  const prevConversationCount = useRef(0);
  const prevActiveConversationId = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, historyFilter]);

  const searching = historyFilter.trim().length > 0;

  const displayList = useMemo(() => {
    if (searching || historyListExpanded || filtered.length <= HISTORY_PREVIEW_COUNT) {
      return filtered;
    }
    return filtered.slice(0, HISTORY_PREVIEW_COUNT);
  }, [filtered, searching, historyListExpanded]);

  const hiddenHistoryCount = filtered.length - HISTORY_PREVIEW_COUNT;
  const showHistoryMore =
    !searching && filtered.length > HISTORY_PREVIEW_COUNT && !historyListExpanded;
  const activeIndexInFiltered = activeConversationId
    ? filtered.findIndex((c) => c.id === activeConversationId)
    : -1;
  const canCollapseHistoryPreview =
    activeIndexInFiltered < 0 || activeIndexInFiltered < HISTORY_PREVIEW_COUNT;
  const showHistoryLess =
    !searching &&
    filtered.length > HISTORY_PREVIEW_COUNT &&
    historyListExpanded &&
    canCollapseHistoryPreview;

  useEffect(() => {
    if (searching) return;
    const prev = prevActiveConversationId.current;
    prevActiveConversationId.current = activeConversationId ?? null;
    if (!activeConversationId || activeConversationId === prev) return;
    const idx = filtered.findIndex((c) => c.id === activeConversationId);
    if (idx >= HISTORY_PREVIEW_COUNT) setHistoryListExpanded(true);
  }, [activeConversationId, filtered, searching]);

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
      className="flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-terminalai-border bg-terminalai-surface"
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
            {conversations.length === 0
              ? 'No saved chats yet. Chats show up here after you send a message.'
              : 'No matches for your search.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {displayList.map((c) => {
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
                          className="my-1 h-7 w-7 shrink-0 rounded-md text-terminalai-muted opacity-70 hover:bg-terminalai-overlay hover:text-terminalai-accentText hover:opacity-100"
                          aria-label={`Rename “${title}”`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenameTarget(c);
                            setRenameTitleDraft(c.title?.trim() ?? '');
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">Rename chat</TooltipContent>
                    </Tooltip>
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
            {showHistoryMore && (
              <li>
                <button
                  type="button"
                  className="w-full rounded-lg border border-transparent px-2.5 py-2 text-left text-2xs font-semibold text-terminalai-accentText transition-colors hover:border-terminalai-border hover:bg-terminalai-hover"
                  onClick={() => setHistoryListExpanded(true)}
                >
                  More{hiddenHistoryCount > 0 ? ` (${hiddenHistoryCount})` : ''}
                </button>
              </li>
            )}
            {showHistoryLess && (
              <li>
                <button
                  type="button"
                  className="w-full rounded-lg border border-transparent px-2.5 py-2 text-left text-2xs font-medium text-terminalai-muted transition-colors hover:border-terminalai-border hover:bg-terminalai-hover hover:text-terminalai-text"
                  onClick={() => setHistoryListExpanded(false)}
                >
                  Show less
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="shrink-0 space-y-1 border-t border-terminalai-borderSubtle p-2.5">
        <div className="flex w-full items-center justify-center">{shortcutsTrigger}</div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-terminalai-muted transition-colors hover:bg-terminalai-hover hover:text-terminalai-text"
        >
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          Settings
        </button>
      </div>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="border-terminalai-border bg-terminalai-elevated text-terminalai-text">
          <DialogHeader>
            <DialogTitle className="text-terminalai-text">Rename chat</DialogTitle>
            <DialogDescription className="text-terminalai-muted">
              This title appears in your chat history list.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameTitleDraft}
            onChange={(e) => setRenameTitleDraft(e.target.value)}
            className="border-terminalai-border bg-terminalai-surface text-terminalai-text"
            placeholder="Chat title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const id = renameTarget?.id;
                if (id) void renameConversation(id, renameTitleDraft.trim());
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-terminalai-accent text-white hover:bg-terminalai-accent/90"
              onClick={() => {
                const id = renameTarget?.id;
                if (id) void renameConversation(id, renameTitleDraft.trim());
                setRenameTarget(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  shortcutsTrigger,
}: {
  catalog: ModelsApiResponse | null;
  onManageKeys: () => void;
  shortcutsTrigger: ReactNode;
}) {
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useSettingsStore((s) => s.setHistoryPanelOpen);
  const messages = useChatStore((s) => s.messages);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const newChat = useChatStore((s) => s.newChat);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const { isStreaming, abortStream } = useChatStream();
  const activeToolCalls = useChatStore((s) => s.activeToolCalls);
  const agentGraphPhase = useChatStore((s) => s.agentGraphPhase);
  const pendingHitlCount = useChatStore(
    (s) => s.hitlApprovals.filter((h) => h.status === 'pending').length
  );
  const liveActivityExplanation = useMemo(() => {
    if (!isStreaming) return null;
    return (
      describeAgentLiveActivity({
        isStreaming: true,
        activeToolCalls,
        pendingHitlCount,
        graphPhase: agentGraphPhase,
      }) ?? 'The model is reasoning or streaming its reply. Open the Tools section above for step details.'
    );
  }, [isStreaming, activeToolCalls, pendingHitlCount, agentGraphPhase]);

  const graphPhaseLine = useMemo(() => {
    if (!isStreaming || !agentGraphPhase) return null;
    if (agentGraphPhase.phase === 'model') {
      const n = agentGraphPhase.langgraphNode?.trim();
      return n && n !== 'agent' ? `Model · ${n}` : 'Model';
    }
    const d = agentGraphPhase.detail?.trim();
    return d ? `Tool · ${humanizeAgentToolName(d)}` : 'Tool';
  }, [isStreaming, agentGraphPhase]);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [slowStreamHint, setSlowStreamHint] = useState(false);
  const { showAgentStreamInterruptedBanner, dismissAgentStreamInterruptedBanner } =
    useAgentStreamInterruptedNotice(activeConversationId);

  useEffect(() => {
    if (!isStreaming) {
      setSlowStreamHint(false);
      return;
    }
    const t = window.setTimeout(() => setSlowStreamHint(true), 4000);
    return () => window.clearTimeout(t);
  }, [isStreaming]);

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
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-terminalai-border px-3.5',
          historyPanelOpen
            ? 'min-h-[48px] pb-3 pt-3.5'
            : 'min-h-[52px] pb-3.5 pt-4 md:min-h-[56px] md:pb-4 md:pt-5'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 shrink-0 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
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
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ModelDropdown catalog={catalog} onManageKeys={onManageKeys} />
          </div>
          <SessionTokenUsageBadge />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {historyPanelOpen ? (
            <>
              <div className="flex shrink-0">{shortcutsTrigger}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
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
                    className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
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
                    className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-accentText max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
                    onClick={() => void newChat()}
                    aria-label="New chat"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New chat</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
                  onClick={() => void clearMessages()}
                  aria-label="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear chat</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>
      {showAgentStreamInterruptedBanner && (
        <div
          className="flex shrink-0 items-start gap-2 border-b border-terminalai-border bg-terminalai-warning/12 px-3.5 py-2.5"
          role="status"
        >
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-terminalai-text">
            This chat may have lost the end of the last assistant reply — the page was closed or
            refreshed while a response was still streaming. Send again or use{' '}
            <span className="font-medium">Regenerate</span> on the partial message if available. The
            model does not resume mid-stream automatically.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 shrink-0 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
            onClick={dismissAgentStreamInterruptedBanner}
            aria-label="Dismiss interrupted stream notice"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3.5"
      >
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-terminalai-borderBright/60 bg-terminalai-elevated/50 px-3.5 py-3.5">
            <p className="text-[12.5px] font-medium text-terminalai-text">Get started</p>
            <ol className="mt-2.5 list-decimal space-y-2 pl-4 text-[12px] leading-relaxed text-terminalai-muted">
              <li>
                Choose a model in the header (cloud providers need an API key —{' '}
                <button
                  type="button"
                  className="text-terminalai-accentText underline decoration-terminalai-border underline-offset-2 hover:text-terminalai-text"
                  onClick={onManageKeys}
                >
                  Manage API keys
                </button>
                ).
              </li>
              <li>Type a question or paste output; press Enter to send (Shift+Enter for a new line).</li>
              <li>
                Click orange underlines in the terminal to attach errors, or use ▶ on suggested commands
                to run them in the active shell.
              </li>
            </ol>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isStreaming && (
          <div
            className="flex w-fit max-w-full flex-col gap-1.5 rounded-lg rounded-bl-sm border border-terminalai-border bg-terminalai-elevated px-3 py-2.5"
            title={liveActivityExplanation ?? undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:0ms] motion-reduce:animate-none" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:200ms] motion-reduce:animate-none" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-terminalai-mutedDeep [animation-delay:400ms] motion-reduce:animate-none" />
              </span>
              <span className="text-2xs text-terminalai-muted">Responding…</span>
              {graphPhaseLine && (
                <span
                  className="rounded border border-terminalai-borderSubtle bg-terminalai-surface px-1.5 py-0.5 font-mono text-[10px] text-terminalai-mutedDeep"
                  title="Coarse LangGraph phase from the agent stream (TerminalAI backend only)."
                >
                  {graphPhaseLine}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminalai-processing focus-visible:ring-offset-2 focus-visible:ring-offset-terminalai-surface max-[899px]:h-9 max-[899px]:w-9 max-[899px]:min-h-[44px] max-[899px]:min-w-[44px]"
                    aria-label="What is the agent doing?"
                  >
                    <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-snug">
                  {liveActivityExplanation}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="ml-1 h-6 gap-1 border-terminalai-border bg-terminalai-overlay text-2xs max-[899px]:h-9 max-[899px]:min-h-[44px] max-[899px]:px-3 max-[899px]:text-xs"
                    onClick={abortStream}
                  >
                    <Square className="h-3 w-3" />
                    Stop
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Stop generation</TooltipContent>
              </Tooltip>
            </div>
            {slowStreamHint && (
              <p className="text-2xs leading-snug text-terminalai-mutedDeep">
                Slow provider or large prompt — text appears incrementally as the model streams.
              </p>
            )}
          </div>
        )}
      </div>
      <HitlApprovalPanel />
      <ChatInput onManageKeys={onManageKeys} />
    </div>
  );
}

export function ChatSidebar({
  catalog,
  onManageKeys,
  shortcutsTrigger,
  shortcutsIconTrigger,
}: {
  catalog: ModelsApiResponse | null;
  onManageKeys: () => void;
  shortcutsTrigger: ReactNode;
  shortcutsIconTrigger: ReactNode;
}) {
  const historyPanelOpen = useSettingsStore((s) => s.historyPanelOpen);
  const [historyFilter, setHistoryFilter] = useState('');
  const setHistoryPanelOpen = useSettingsStore((s) => s.setHistoryPanelOpen);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-terminalai-surface md:flex-row">
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          'w-full',
          historyPanelOpen ? 'md:w-[220px]' : 'md:w-14'
        )}
      >
        {historyPanelOpen ? (
          <ChatHistoryColumn
            historyFilter={historyFilter}
            setHistoryFilter={setHistoryFilter}
            onOpenSettings={onManageKeys}
            shortcutsTrigger={shortcutsTrigger}
          />
        ) : (
          <ChatHistoryIconRail
            onOpenHistory={() => setHistoryPanelOpen(true)}
            onOpenSettings={onManageKeys}
            shortcutsIconTrigger={shortcutsIconTrigger}
          />
        )}
      </div>
      <ChatbotColumn
        catalog={catalog}
        onManageKeys={onManageKeys}
        shortcutsTrigger={shortcutsTrigger}
      />
    </div>
  );
}
