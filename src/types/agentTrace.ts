import type { ToolActivityCategory } from '@/lib/agentStreamProtocol';

/** One step in the assistant turn: model/tool phase or a tool invocation. */
export type AgentTraceEntry =
  | {
      kind: 'graph_phase';
      phase: 'model' | 'tool';
      detail?: string;
      langgraphNode?: string;
    }
  | {
      kind: 'tool';
      callId: string;
      toolName: string;
      phase: 'running' | 'awaiting_approval' | 'done' | 'error';
      title?: string;
      subtitle?: string;
      category?: ToolActivityCategory;
      preview?: string;
      error?: string;
      secretHint?: string;
      elapsedMs?: number;
      approvalId?: string;
    };

export const MAX_STORED_AGENT_TRACE_PREVIEW_CHARS = 12_000;

function cap(s: string | undefined, max: number): string | undefined {
  if (s == null || s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} chars]`;
}

/** Normalize API/DB JSON into a safe display list (drops invalid items). */
export function parseAgentTraceJson(raw: string | null | undefined): AgentTraceEntry[] {
  if (raw == null || raw === '') return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: AgentTraceEntry[] = [];
    for (const x of v) {
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      if (o.kind === 'graph_phase') {
        const ph = o.phase;
        if (ph !== 'model' && ph !== 'tool') continue;
        out.push({
          kind: 'graph_phase',
          phase: ph,
          ...(typeof o.detail === 'string' ? { detail: o.detail } : {}),
          ...(typeof o.langgraphNode === 'string' ? { langgraphNode: o.langgraphNode } : {}),
        });
        continue;
      }
      if (o.kind === 'tool') {
        if (typeof o.callId !== 'string' || typeof o.toolName !== 'string') continue;
        const phase = o.phase;
        if (
          phase !== 'running' &&
          phase !== 'awaiting_approval' &&
          phase !== 'done' &&
          phase !== 'error'
        ) {
          continue;
        }
        out.push({
          kind: 'tool',
          callId: o.callId,
          toolName: o.toolName,
          phase,
          ...(typeof o.title === 'string' ? { title: o.title } : {}),
          ...(typeof o.subtitle === 'string' ? { subtitle: o.subtitle } : {}),
          ...(typeof o.category === 'string' ? { category: o.category as ToolActivityCategory } : {}),
          ...(typeof o.preview === 'string' ? { preview: o.preview } : {}),
          ...(typeof o.error === 'string' ? { error: o.error } : {}),
          ...(typeof o.secretHint === 'string' ? { secretHint: o.secretHint } : {}),
          ...(typeof o.elapsedMs === 'number' && Number.isFinite(o.elapsedMs)
            ? { elapsedMs: Math.max(0, Math.round(o.elapsedMs)) }
            : {}),
          ...(typeof o.approvalId === 'string' ? { approvalId: o.approvalId } : {}),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Cap previews/errors before SQLite PATCH. */
export function clampAgentTraceForStorage(entries: AgentTraceEntry[]): AgentTraceEntry[] {
  const max = MAX_STORED_AGENT_TRACE_PREVIEW_CHARS;
  return entries.map((e) => {
    if (e.kind !== 'tool') return e;
    return {
      ...e,
      ...(e.preview != null ? { preview: cap(e.preview, max) } : {}),
      ...(e.error != null ? { error: cap(e.error, max) } : {}),
      ...(e.subtitle != null ? { subtitle: cap(e.subtitle, 2048) } : {}),
    };
  });
}

/** Mark running tools as interrupted (abort / incomplete persist). */
export function finalizeAgentTraceForPersist(entries: AgentTraceEntry[]): AgentTraceEntry[] {
  return entries.map((e) => {
    if (e.kind !== 'tool' || e.phase !== 'running') return e;
    return {
      ...e,
      phase: 'error',
      error: 'Stopped before completion.',
      preview: undefined,
    };
  });
}
