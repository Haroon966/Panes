'use client';

import { ChevronDown, ChevronRight, File, Folder, PanelLeftClose, Terminal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  listWorkspaceDir,
  type WorkspaceEditorContext,
  type WorkspaceListEntry,
} from '@/lib/workspaceEditorApi';
import { cn } from '@/lib/utils';

function joinPath(dir: string, name: string): string {
  if (!dir || dir === '.') return name;
  return `${dir.replace(/\/$/, '')}/${name}`;
}

function scrollToTerminalPanel(): void {
  document
    .querySelector<HTMLElement>('[data-terminalai-terminal-panel]')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function TreeNode({
  relPath,
  name,
  depth,
  ctx,
  treeVersion,
  onOpenFile,
  selectedPath,
}: {
  relPath: string;
  name: string;
  depth: number;
  ctx: WorkspaceEditorContext;
  treeVersion: number;
  onOpenFile: (rel: string) => void;
  selectedPath: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<WorkspaceListEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setChildren(null);
    setErr(null);
  }, [treeVersion]);

  useEffect(() => {
    if (!open || children !== null) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void listWorkspaceDir(relPath, ctx)
      .then((r) => {
        if (!cancelled) setChildren(r.entries);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, relPath, ctx, children]);

  const pad = 6 + depth * 10;

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-0.5 py-0.5 text-left text-[13px] text-terminalai-text hover:bg-terminalai-hover'
        )}
        style={{ paddingLeft: pad }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-terminalai-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-terminalai-muted" />
        )}
        <Folder className="h-3 w-3 shrink-0" />
        <span className="min-w-0 truncate font-mono">{name}</span>
      </button>
      {open && loading && (
        <div className="py-1 pl-6 text-[12px] text-terminalai-muted" style={{ paddingLeft: pad + 14 }}>
          Loading…
        </div>
      )}
      {open && err && (
        <div className="py-1 text-[12px] text-terminalai-danger" style={{ paddingLeft: pad + 14 }}>
          {err}
        </div>
      )}
      {open &&
        children?.map((e) =>
          e.kind === 'dir' ? (
            <TreeNode
              key={joinPath(relPath, e.name)}
              relPath={joinPath(relPath, e.name)}
              name={e.name}
              depth={depth + 1}
              ctx={ctx}
              treeVersion={treeVersion}
              onOpenFile={onOpenFile}
              selectedPath={selectedPath}
            />
          ) : (
            <button
              key={joinPath(relPath, e.name)}
              type="button"
                className={cn(
                  'flex w-full items-center gap-1 py-0.5 text-left font-mono text-[13px] hover:bg-terminalai-hover',
                  selectedPath === joinPath(relPath, e.name)
                    ? 'bg-terminalai-overlay text-terminalai-text'
                    : 'text-terminalai-text'
                )}
              style={{ paddingLeft: pad + 14 }}
              onClick={() => onOpenFile(joinPath(relPath, e.name))}
            >
              <File className="h-3 w-3 shrink-0 opacity-70" />
              <span className="min-w-0 truncate">{e.name}</span>
            </button>
          )
        )}
    </div>
  );
}

type Props = {
  ctx: WorkspaceEditorContext;
  workspaceRootHint: string;
  terminalLinked: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenFile: (relPath: string) => void;
  selectedPath: string | null;
  /** Bumps with editor save/load so the tree picks up new files. */
  fileTreeEpoch?: number;
};

export function WorkspaceEditorFileSidebar({
  ctx,
  workspaceRootHint,
  terminalLinked,
  collapsed,
  onToggleCollapse,
  onOpenFile,
  selectedPath,
  fileTreeEpoch = 0,
}: Props) {
  const [rootEntries, setRootEntries] = useState<WorkspaceListEntry[] | null>(null);
  const [rootLoading, setRootLoading] = useState(true);
  const [rootErr, setRootErr] = useState<string | null>(null);
  const [treeVersion, setTreeVersion] = useState(0);
  const prevFileTreeEpoch = useRef(fileTreeEpoch);

  const reloadRoot = useCallback((mode: 'initial' | 'refresh' = 'initial') => {
    const initial = mode === 'initial';
    if (initial) {
      setRootLoading(true);
      setRootErr(null);
      setRootEntries(null);
    }
    void listWorkspaceDir('.', ctx)
      .then((r) => {
        setRootEntries(r.entries);
        setRootErr(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setRootErr(msg);
        if (initial) setRootEntries([]);
      })
      .finally(() => {
        if (initial) setRootLoading(false);
      });
  }, [ctx]);

  useEffect(() => {
    reloadRoot(treeVersion === 0 ? 'initial' : 'refresh');
  }, [reloadRoot, treeVersion]);

  useEffect(() => {
    if (prevFileTreeEpoch.current !== fileTreeEpoch) {
      prevFileTreeEpoch.current = fileTreeEpoch;
      setTreeVersion((v) => v + 1);
    }
  }, [fileTreeEpoch]);

  useEffect(() => {
    if (collapsed) return;
    const id = window.setInterval(() => setTreeVersion((v) => v + 1), 4000);
    return () => window.clearInterval(id);
  }, [collapsed]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setTreeVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const handleOpenFile = useCallback(
    (rel: string) => {
      scrollToTerminalPanel();
      onOpenFile(rel);
    },
    [onOpenFile]
  );

  if (collapsed) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-r border-[var(--terminalai-editor-border)] bg-[var(--terminalai-editor-tab-bar)] py-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-terminalai-text hover:bg-terminalai-hover hover:text-terminalai-text"
              onClick={onToggleCollapse}
              aria-label="Show file tree"
            >
              <Folder className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Show file tree</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const rootLabel = workspaceRootHint.trim()
    ? workspaceRootHint.trim().split(/[/\\]/).filter(Boolean).pop() ?? 'Workspace'
    : 'Workspace';

  return (
    <div className="flex w-[13.5rem] shrink-0 flex-col border-r border-[var(--terminalai-editor-border)] bg-[var(--terminalai-editor-tab-bar)]">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--terminalai-editor-border)] px-2 py-1.5">
        <Folder className="h-3.5 w-3.5 shrink-0 text-terminalai-text" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-terminalai-muted">
          Explorer
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-terminalai-text hover:bg-terminalai-hover"
              onClick={onToggleCollapse}
              aria-label="Hide file tree"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Hide file tree</TooltipContent>
        </Tooltip>
      </div>
      <div className="shrink-0 border-b border-[var(--terminalai-editor-border)] px-2 py-2">
        <div className="flex items-start gap-1.5 text-[11px] leading-snug text-terminalai-muted">
          <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terminalai-processing" aria-hidden />
          <span>
            Same root as the agent
            {terminalLinked ? ' and integrated terminal' : ''}
            {terminalLinked ? ' (PTY cwd).' : ' (persisted cwd when shell disconnected).'} Opening a file
            scrolls the terminal into view.
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {rootLoading && <p className="px-2 text-[12px] text-terminalai-muted">Loading…</p>}
        {rootErr && <p className="px-2 text-[12px] text-terminalai-danger">{rootErr}</p>}
        {!rootLoading &&
          !rootErr &&
          rootEntries?.map((e) =>
            e.kind === 'dir' ? (
              <TreeNode
                key={e.name}
                relPath={e.name}
                name={e.name}
                depth={0}
                ctx={ctx}
                treeVersion={treeVersion}
                onOpenFile={handleOpenFile}
                selectedPath={selectedPath}
              />
            ) : (
              <button
                key={e.name}
                type="button"
                className={cn(
                  'flex w-full items-center gap-1 px-2 py-0.5 text-left font-mono text-[13px] hover:bg-terminalai-hover',
                  selectedPath === e.name ? 'bg-terminalai-overlay text-terminalai-text' : 'text-terminalai-text'
                )}
                style={{ paddingLeft: 8 }}
                onClick={() => handleOpenFile(e.name)}
              >
                <File className="h-3 w-3 shrink-0 opacity-70" />
                <span className="min-w-0 truncate">{e.name}</span>
              </button>
            )
          )}
        {!rootLoading && !rootErr && rootEntries?.length === 0 && (
          <p className="px-2 text-[12px] text-terminalai-muted">Empty folder.</p>
        )}
      </div>
      <div className="shrink-0 border-t border-[var(--terminalai-editor-border)] px-2 py-1 font-mono text-[10px] text-terminalai-muted">
        {rootLabel}
      </div>
    </div>
  );
}
