'use client';

import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const PREVIEW_MAX_LINES = 14;

function DiffLine({ line }: { line: string }) {
  const safe = line || ' ';
  if (safe.startsWith('+++') || safe.startsWith('---')) {
    return (
      <div className="text-[11px] leading-snug text-terminalai-muted opacity-90">{safe}</div>
    );
  }
  if (safe.startsWith('@@')) {
    return (
      <div className="text-[11px] leading-snug text-terminalai-accentText/90">{safe}</div>
    );
  }
  if (safe.startsWith('+') && !safe.startsWith('+++')) {
    return (
      <div className="border-l-2 border-terminalai-success/60 bg-terminalai-success/10 pl-2 text-[11px] leading-snug text-terminalai-text">
        {safe}
      </div>
    );
  }
  if (safe.startsWith('-') && !safe.startsWith('---')) {
    return (
      <div className="border-l-2 border-terminalai-danger/60 bg-terminalai-danger/10 pl-2 text-[11px] leading-snug text-terminalai-text">
        {safe}
      </div>
    );
  }
  return (
    <div className="text-[11px] leading-snug text-terminalai-mutedDeep">{safe}</div>
  );
}

export function ChatDiffFence({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');
  const total = lines.length;
  const preview = lines.slice(0, PREVIEW_MAX_LINES);
  const truncated = total > PREVIEW_MAX_LINES;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="relative my-2 rounded-lg border border-terminalai-border bg-terminalai-base">
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-2.5 py-1.5',
            !collapsed && 'border-b border-terminalai-borderSubtle'
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand diff preview' : 'Collapse diff preview'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
            </button>
            <span className="rounded bg-terminalai-overlay px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-terminalai-muted">
              Diff
            </span>
            <span className="truncate text-2xs text-terminalai-muted">
              {total} line{total === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-2xs text-terminalai-muted hover:text-terminalai-text"
              onClick={() => void copyAll()}
              aria-label="Copy diff"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-terminalai-border bg-terminalai-surface px-2 text-2xs text-terminalai-text hover:bg-terminalai-hover"
              onClick={() => setOpen(true)}
            >
              {truncated ? `View full (${total} lines)` : 'Expand'}
            </Button>
          </div>
        </div>
        {!collapsed && (
          <button
            type="button"
            className={cn(
              'w-full text-left outline-none ring-terminalai-processing focus-visible:ring-1',
              'cursor-pointer'
            )}
            onClick={() => setOpen(true)}
            aria-label="Open full diff view"
          >
            <div className="max-h-[min(280px,40vh)] space-y-px overflow-y-auto p-2 font-mono">
              {preview.map((line, i) => (
                <DiffLine key={`${i}-${line.slice(0, 24)}`} line={line} />
              ))}
              {truncated && (
                <div className="pt-1 text-center text-[10px] text-terminalai-muted">
                  … {total - PREVIEW_MAX_LINES} more lines — click to open
                </div>
              )}
            </div>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-3xl overflow-hidden border-terminalai-border bg-terminalai-elevated text-terminalai-text">
          <DialogHeader>
            <DialogTitle className="text-terminalai-text">Diff</DialogTitle>
            <DialogDescription className="text-terminalai-muted">
              Unified or git-style diff from the assistant message. Copy to paste into a patch file or
              review in your editor.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70vh,520px)] overflow-auto rounded-md border border-terminalai-border bg-terminalai-base p-3">
            <div className="space-y-px font-mono">
              {lines.map((line, i) => (
                <DiffLine key={`d-${i}-${line.slice(0, 16)}`} line={line} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-terminalai-borderSubtle pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" className="bg-terminalai-accent text-white" onClick={() => void copyAll()}>
              Copy full diff
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
