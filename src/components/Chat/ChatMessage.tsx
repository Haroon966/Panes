'use client';

import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Check, Copy, MoreHorizontal, Pencil, RefreshCw, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ChatMessage as Msg } from '@/types/chat';
import {
  isLikelyWorkspaceRelativePath,
  parseWorkspacePathWithLine,
} from '@/lib/workspacePathHeuristic';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chatStore';
import { useWorkbenchStore } from '@/store/workbenchStore';
import { AgentMessageTrace } from './AgentMessageTrace';
import { ChatDiffFence } from './ChatDiffFence';
import { CommandButton } from './CommandButton';

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === 'user';
  const isStreaming = useChatStore((s) => s.isStreaming);
  const lastMessageId = useChatStore((s) => s.messages[s.messages.length - 1]?.id);
  const isLiveStreamingAssistant =
    !isUser && isStreaming && message.id === lastMessageId;
  const setA11yAnnouncement = useChatStore((s) => s.setA11yAnnouncement);
  const regenerateAssistantMessage = useChatStore((s) => s.regenerateAssistantMessage);
  const rewriteAssistantMessage = useChatStore((s) => s.rewriteAssistantMessage);
  const applyUserMessageRewrite = useChatStore((s) => s.applyUserMessageRewrite);
  const setMessageAlternateVersion = useChatStore((s) => s.setMessageAlternateVersion);
  const requestOpenEditorFile = useWorkbenchStore((s) => s.requestOpenEditorFile);

  const [userRewriteOpen, setUserRewriteOpen] = useState(false);
  const [userDraft, setUserDraft] = useState(message.content);
  const [asstRewriteOpen, setAsstRewriteOpen] = useState(false);
  const [rewriteHintDraft, setRewriteHintDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alternates = message.alternates ?? [];
  const hasVersions = alternates.length > 0;
  const actionsDisabled = isStreaming;

  useEffect(() => {
    setCopied(false);
  }, [message.content]);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setA11yAnnouncement('Copied message to clipboard.');
      setCopied(true);
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
      copiedResetRef.current = setTimeout(() => {
        setCopied(false);
        copiedResetRef.current = null;
      }, 2000);
    } catch {
      setA11yAnnouncement('Copy failed.');
    }
  };

  const openUserRewrite = () => {
    setUserDraft(message.content);
    setUserRewriteOpen(true);
  };

  const submitUserRewrite = () => {
    setUserRewriteOpen(false);
    void applyUserMessageRewrite(message.id, userDraft);
  };

  const submitAssistantRewrite = () => {
    setAsstRewriteOpen(false);
    void rewriteAssistantMessage(message.id, rewriteHintDraft.trim() || undefined);
    setRewriteHintDraft('');
  };

  const ActionButtons = (
    <div
      className={cn(
        'flex shrink-0 items-center gap-0.5 transition-opacity duration-150',
        'opacity-100 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100'
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 hover:bg-terminalai-hover',
              copied
                ? 'text-terminalai-success'
                : 'text-terminalai-muted hover:text-terminalai-text'
            )}
            disabled={actionsDisabled}
            onClick={() => void copy()}
            aria-label={copied ? 'Copied' : 'Copy message'}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>
      {isUser ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
              disabled={actionsDisabled}
              onClick={openUserRewrite}
              aria-label="Rewrite prompt"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Rewrite prompt</TooltipContent>
        </Tooltip>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                disabled={actionsDisabled}
                onClick={() => void regenerateAssistantMessage(message.id)}
                aria-label="Regenerate response"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Regenerate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                disabled={actionsDisabled}
                onClick={() => setAsstRewriteOpen(true)}
                aria-label="Rewrite response"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Rewrite response</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'group flex animate-in fade-in-0 slide-in-from-bottom-2 flex-col gap-1.5 duration-200 focus-within:outline-none',
        {
          'items-end': isUser,
          'items-start': !isUser,
        }
      )}
      tabIndex={-1}
    >
      <div className="flex max-w-[95%] flex-col gap-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold',
              isUser
                ? 'border border-terminalai-borderBright bg-terminalai-overlay text-terminalai-muted'
                : 'bg-gradient-to-br from-terminalai-accent to-[#c084fc] text-white'
            )}
            aria-hidden
          >
            {isUser ? 'U' : 'AI'}
          </div>
          <span className="text-[11px] font-semibold text-terminalai-muted">
            {isUser ? 'You' : 'Assistant'}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            {ActionButtons}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
                  aria-label="Message actions"
                  disabled={actionsDisabled}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-terminalai-border bg-terminalai-elevated text-terminalai-text"
              >
                <DropdownMenuItem
                  className="focus:bg-terminalai-hover"
                  onClick={() => void copy()}
                >
                  Copy
                </DropdownMenuItem>
                {isUser ? (
                  <DropdownMenuItem
                    className="focus:bg-terminalai-hover"
                    onClick={openUserRewrite}
                  >
                    Rewrite prompt
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      className="focus:bg-terminalai-hover"
                      onClick={() => void regenerateAssistantMessage(message.id)}
                    >
                      Regenerate response
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="focus:bg-terminalai-hover"
                      onClick={() => setAsstRewriteOpen(true)}
                    >
                      Rewrite response…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div
          className={cn(
            'rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed text-terminalai-text',
            'rounded-bl-sm',
            isUser
              ? 'border-terminalai-borderBright bg-terminalai-overlay'
              : 'border-terminalai-border bg-terminalai-elevated'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
          {message.agentTrace != null && message.agentTrace.length > 0 && (
            <AgentMessageTrace trace={message.agentTrace} />
          )}
            {isLiveStreamingAssistant &&
              !message.content.trim() &&
              !(message.agentTrace && message.agentTrace.length > 0) && (
                <p className="mb-2 text-2xs italic text-terminalai-muted">
                  Connecting to model…
                </p>
              )}
            {message.content.trim().length > 0 ? (
            <ReactMarkdown
              components={{
                code({ className, children }) {
                  const text = String(children).replace(/\n$/, '');
                  const match = /language-(\w+)/.exec(className || '');
                  const lang = match?.[1] ?? '';
                  const block = Boolean(className?.includes('language-'));
                  if (!block) {
                    const pathLine = parseWorkspacePathWithLine(text);
                    if (pathLine) {
                      return (
                        <button
                          type="button"
                          className="rounded bg-terminalai-hover px-1.5 py-0.5 font-mono text-[11px] text-terminalai-accent underline-offset-2 hover:underline"
                          title={`Open in workspace editor at line ${pathLine.line}`}
                          onClick={() =>
                            requestOpenEditorFile(pathLine.path, pathLine.line)
                          }
                        >
                          {text}
                        </button>
                      );
                    }
                    if (isLikelyWorkspaceRelativePath(text)) {
                      return (
                        <button
                          type="button"
                          className="rounded bg-terminalai-hover px-1.5 py-0.5 font-mono text-[11px] text-terminalai-accent underline-offset-2 hover:underline"
                          title="Open in workspace editor"
                          onClick={() => requestOpenEditorFile(text)}
                        >
                          {text}
                        </button>
                      );
                    }
                    return (
                      <code className="rounded bg-terminalai-hover px-1.5 py-0.5 font-mono text-[11px] text-terminalai-cyan">
                        {text}
                      </code>
                    );
                  }
                  if (lang === 'diff' || lang === 'patch') {
                    return <ChatDiffFence content={text} />;
                  }
                  const shellish = ['bash', 'sh', 'shell', 'zsh', 'fish'].includes(lang);
                  const first = text.split('\n')[0]?.trim() ?? text;
                  let html = text;
                  try {
                    const l = hljs.getLanguage(lang) ? lang : 'bash';
                    html = hljs.highlight(text, { language: l }).value;
                  } catch {
                    html = hljs.highlightAuto(text).value;
                  }
                  return (
                    <div className="relative my-2 rounded-lg border border-terminalai-border bg-terminalai-base">
                      {shellish && <CommandButton command={first} />}
                      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
                        <code dangerouslySetInnerHTML={{ __html: html }} />
                      </pre>
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            ) : null}
            </>
          )}
        </div>
        {hasVersions && (
          <div className="flex flex-wrap items-center gap-2 px-0.5">
            <Label className="text-2xs text-terminalai-mutedDeep">Prior versions</Label>
            <select
              className="h-7 max-w-[200px] rounded-md border border-terminalai-border bg-terminalai-elevated px-2 text-2xs text-terminalai-text"
              aria-label="Switch message version"
              disabled={actionsDisabled}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) void setMessageAlternateVersion(message.id, v);
                e.target.value = '';
              }}
            >
              <option value="">Swap in prior wording…</option>
              {alternates.map((a, i) => (
                <option key={a.id} value={a.id}>
                  Version {i + 1} ({new Date(a.createdAt).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Dialog open={userRewriteOpen} onOpenChange={setUserRewriteOpen}>
        <DialogContent className="border-terminalai-border bg-terminalai-elevated text-terminalai-text">
          <DialogHeader>
            <DialogTitle className="text-terminalai-text">Rewrite prompt</DialogTitle>
            <DialogDescription className="text-terminalai-muted">
              Edit your message. Earlier wording is kept in version history. Messages below this one
              are removed and the assistant will reply again.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={userDraft}
            onChange={(e) => setUserDraft(e.target.value)}
            className="min-h-[120px] border-terminalai-border bg-terminalai-surface text-terminalai-text"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setUserRewriteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-terminalai-accent text-white hover:bg-terminalai-accent/90"
              disabled={!userDraft.trim() || actionsDisabled}
              onClick={submitUserRewrite}
            >
              Save and regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={asstRewriteOpen} onOpenChange={setAsstRewriteOpen}>
        <DialogContent className="border-terminalai-border bg-terminalai-elevated text-terminalai-text">
          <DialogHeader>
            <DialogTitle className="text-terminalai-text">Rewrite response</DialogTitle>
            <DialogDescription className="text-terminalai-muted">
              Optional instruction for how to rewrite (leave empty for a general improvement pass).
              The current response is kept in version history.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rewriteHintDraft}
            onChange={(e) => setRewriteHintDraft(e.target.value)}
            placeholder="e.g. Shorter, more formal, add examples…"
            className="min-h-[88px] border-terminalai-border bg-terminalai-surface text-terminalai-text"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAsstRewriteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-terminalai-accent text-white hover:bg-terminalai-accent/90"
              disabled={actionsDisabled}
              onClick={submitAssistantRewrite}
            >
              Rewrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
