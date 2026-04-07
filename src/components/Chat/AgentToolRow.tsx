'use client';

import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileSearch,
  FileText,
  FolderOpen,
  Loader2,
  Monitor,
  Pencil,
  Search,
  SquarePen,
  Terminal,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { humanizeAgentToolName } from '@/lib/agentActivitySummary';
import { useChatStore, type AgentToolCallRow } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HitlApprovalCard } from './HitlApprovalPanel';

function ActivityIcon({ row }: { row: AgentToolCallRow }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  const cat = row.category;
  if (cat === 'shell') {
    return <Terminal className={cn(cls, 'text-terminalai-processing')} aria-hidden />;
  }
  if (cat === 'file_read') {
    return <FileText className={cn(cls, 'text-terminalai-muted')} aria-hidden />;
  }
  if (cat === 'file_write') {
    const isCreate = row.title === 'Create file';
    if (isCreate) {
      return <FilePlus className={cn(cls, 'text-terminalai-accentText')} aria-hidden />;
    }
    return <SquarePen className={cn(cls, 'text-terminalai-accentText')} aria-hidden />;
  }
  if (cat === 'file_patch') {
    return <Pencil className={cn(cls, 'text-terminalai-warning')} aria-hidden />;
  }
  if (cat === 'list') {
    return <FolderOpen className={cn(cls, 'text-terminalai-accentText')} aria-hidden />;
  }
  if (cat === 'find') {
    return <FileSearch className={cn(cls, 'text-terminalai-muted')} aria-hidden />;
  }
  if (cat === 'grep') {
    return <Search className={cn(cls, 'text-terminalai-muted')} aria-hidden />;
  }
  if (cat === 'terminal') {
    return <Monitor className={cn(cls, 'text-terminalai-processing')} aria-hidden />;
  }
  return <Wrench className={cn(cls, 'text-terminalai-muted')} aria-hidden />;
}

/** One tool invocation row (live stream or persisted trace). */
export function AgentToolRow({ row }: { row: AgentToolCallRow }) {
  const [open, setOpen] = useState(false);
  const hitlRows = useChatStore((s) => s.hitlApprovals);
  const pendingHitl =
    row.approvalId != null
      ? hitlRows.find((h) => h.approvalId === row.approvalId && h.status === 'pending')
      : undefined;
  const showInlineApproval = row.phase === 'awaiting_approval' && pendingHitl && row.callId;

  const running = row.phase === 'running';
  const primary = row.title?.trim() || humanizeAgentToolName(row.toolName);
  const subtitle = row.subtitle?.trim();

  const hasExpandableBody =
    (row.preview != null && row.preview.length > 0) ||
    (row.error != null && row.error.length > 0) ||
    (row.secretHint != null && row.secretHint.length > 0) ||
    showInlineApproval ||
    (subtitle != null && subtitle.length > 0);

  const statusLabel =
    row.phase === 'running'
      ? 'Running…'
      : row.phase === 'awaiting_approval'
        ? 'Awaiting approval'
        : row.phase === 'error'
          ? 'Error'
          : 'Done';

  const timingSuffix =
    row.phase !== 'running' && row.elapsedMs != null && row.elapsedMs >= 0
      ? ` · ${row.elapsedMs}ms`
      : '';

  const headerButton = (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-2 px-3 py-2 text-left font-medium text-terminalai-text hover:bg-terminalai-hover/60',
        running && 'animate-pulse border-l-2 border-l-terminalai-accent'
      )}
      onClick={() => hasExpandableBody && setOpen((o) => !o)}
      disabled={!hasExpandableBody}
      aria-expanded={open}
    >
      {hasExpandableBody ? (
        open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terminalai-muted" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terminalai-muted" />
        )
      ) : (
        <span className="mt-0.5 w-3.5 shrink-0" aria-hidden />
      )}
      {running ? (
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-terminalai-accentText" />
      ) : (
        <span className="mt-0.5">
          <ActivityIcon row={row} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] leading-snug text-terminalai-text">{primary}</span>
        {subtitle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-0.5 block truncate font-mono text-2xs text-terminalai-muted">
                {subtitle}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md font-mono text-2xs">
              {subtitle}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="shrink-0 whitespace-nowrap text-2xs text-terminalai-mutedDeep">
        {statusLabel}
        {timingSuffix}
      </span>
    </button>
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-terminalai-border bg-terminalai-overlay/80 text-[12px] leading-snug transition-colors',
        row.phase === 'error' && 'border-terminalai-warning/35',
        row.phase === 'awaiting_approval' && 'border-terminalai-accent/25',
        running && 'border-terminalai-accent/20 shadow-[0_0_0_1px_rgba(124,106,247,0.12)]'
      )}
    >
      {headerButton}
      {open && hasExpandableBody && (
        <div className="border-t border-terminalai-borderSubtle px-3 py-2">
          {subtitle && (
            <pre className="mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-terminalai-elevated/80 p-2 font-mono text-2xs text-terminalai-muted">
              {subtitle}
            </pre>
          )}
          {row.error != null && row.error.length > 0 && (
            <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-terminalai-elevated/80 p-2 font-mono text-2xs text-terminalai-warning">
              {row.error}
            </pre>
          )}
          {row.secretHint != null && row.secretHint.length > 0 && (
            <p className="mb-2 rounded border border-terminalai-warning/30 bg-terminalai-warning/10 px-2 py-1.5 text-2xs text-terminalai-warning">
              {row.secretHint}
            </p>
          )}
          {row.preview != null && row.preview.length > 0 && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-terminalai-elevated/80 p-2 font-mono text-2xs text-terminalai-muted">
              {row.preview}
            </pre>
          )}
          {showInlineApproval && pendingHitl && row.callId && (
            <div className="mt-2">
              <HitlApprovalCard
                row={pendingHitl}
                variant="inline"
                toolCallId={row.callId}
              />
            </div>
          )}
        </div>
      )}
      {!open && showInlineApproval && pendingHitl && row.callId && (
        <div className="border-t border-terminalai-borderSubtle px-3 py-2">
          <HitlApprovalCard row={pendingHitl} variant="inline" toolCallId={row.callId} />
        </div>
      )}
    </div>
  );
}
