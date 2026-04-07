'use client';

import { Cable } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { parseMcpConfigJson } from '@/lib/mcpConfigParse';
import { cn } from '@/lib/utils';
import { fetchWorkspaceFile, type WorkspaceEditorContext } from '@/lib/workspaceEditorApi';

type HintState =
  | { kind: 'idle' }
  | { kind: 'absent' }
  | { kind: 'ok'; names: string[] }
  | { kind: 'bad'; message: string };

function isNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('not found') || m.includes('404');
}

export function WorkspaceMcpConfigBadge({ ctx }: { ctx: WorkspaceEditorContext }) {
  const [hint, setHint] = useState<HintState>({ kind: 'idle' });

  useEffect(() => {
    if (!ctx.workspaceRoot?.trim()) {
      setHint({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchWorkspaceFile('.mcp.json', ctx);
        if (cancelled) return;
        const p = parseMcpConfigJson(r.content);
        if (!p.ok) {
          setHint({ kind: 'bad', message: p.error });
          return;
        }
        setHint({ kind: 'ok', names: p.servers.map((s) => s.name) });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (isNotFoundError(msg)) {
          setHint({ kind: 'absent' });
        } else {
          setHint({ kind: 'idle' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  if (hint.kind === 'idle' || hint.kind === 'absent') return null;

  if (hint.kind === 'bad') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex max-w-[140px] shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]',
              'text-terminalai-warning'
            )}
            aria-label="Invalid .mcp.json"
          >
            <Cable className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">MCP config</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <p className="font-medium">Could not parse `.mcp.json`</p>
          <p className="mt-1 text-2xs text-terminalai-muted">{hint.message}</p>
          <p className="mt-2 text-2xs text-terminalai-muted">
            Expected a top-level <code className="font-mono">mcpServers</code> object (Cursor / VS Code
            style). The agent does not connect to MCP yet — this badge is informational.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const n = hint.names.length;
  const title =
    n > 0 ? hint.names.join(', ') : 'No servers listed under mcpServers';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex max-w-[160px] shrink-0 cursor-default items-center gap-1 rounded bg-terminalai-overlay px-1.5 py-0.5 font-mono text-[10px] text-terminalai-muted"
          aria-label={`MCP config: ${n} server${n === 1 ? '' : 's'}`}
        >
          <Cable className="h-3 w-3 shrink-0 text-terminalai-accentText opacity-80" aria-hidden />
          <span className="truncate">
            MCP · {n} server{n === 1 ? '' : 's'}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-2xs font-medium text-terminalai-text">`.mcp.json` in workspace root</p>
        <p className="mt-1 break-words text-2xs text-terminalai-muted">{title}</p>
        <p className="mt-2 text-2xs text-terminalai-muted">
          MCP tools are not wired into the Agent graph yet — this is discovery only.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
