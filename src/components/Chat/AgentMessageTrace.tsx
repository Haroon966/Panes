'use client';

import { humanizeAgentToolName } from '@/lib/agentActivitySummary';
import type { AgentTraceEntry } from '@/types/agentTrace';
import type { AgentToolCallRow } from '@/store/chatStore';
import { cn } from '@/lib/utils';
import { AgentToolRow } from './AgentToolRow';

function traceToolToRow(e: Extract<AgentTraceEntry, { kind: 'tool' }>): AgentToolCallRow {
  return {
    callId: e.callId,
    toolName: e.toolName,
    phase: e.phase,
    title: e.title,
    subtitle: e.subtitle,
    category: e.category,
    preview: e.preview,
    error: e.error,
    secretHint: e.secretHint,
    elapsedMs: e.elapsedMs,
    approvalId: e.approvalId,
  };
}

function GraphPhaseRow({ entry }: { entry: Extract<AgentTraceEntry, { kind: 'graph_phase' }> }) {
  const label =
    entry.phase === 'model'
      ? entry.langgraphNode?.trim() && entry.langgraphNode !== 'agent'
        ? `Model · ${entry.langgraphNode}`
        : 'Model'
      : entry.detail?.trim()
        ? `Tool · ${humanizeAgentToolName(entry.detail)}`
        : 'Tool';
  return (
    <div
      className={cn(
        'rounded-md border border-terminalai-borderSubtle bg-terminalai-surface/90 px-2.5 py-1.5 font-mono text-2xs text-terminalai-mutedDeep'
      )}
      role="status"
    >
      {label}
    </div>
  );
}

/** Renders persisted or live LangGraph steps above assistant prose. */
export function AgentMessageTrace({ trace }: { trace: AgentTraceEntry[] }) {
  if (trace.length === 0) return null;
  return (
    <div className="mb-2 space-y-1.5" aria-label="Agent steps">
      <div className="text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
        Steps
      </div>
      <div className="space-y-1.5">
        {trace.map((e, i) =>
          e.kind === 'graph_phase' ? (
            <GraphPhaseRow
              key={`gp-${i}-${e.phase}-${e.detail ?? ''}-${e.langgraphNode ?? ''}`}
              entry={e}
            />
          ) : (
            <AgentToolRow key={e.callId} row={traceToolToRow(e)} />
          )
        )}
      </div>
    </div>
  );
}
