export const TERMINALAI_EVENT_PREFIX = 'TERMINALAI_EVENT:';

export type ToolActivityCategory =
  | 'shell'
  | 'file_read'
  | 'file_write'
  | 'file_patch'
  | 'list'
  | 'find'
  | 'grep'
  | 'terminal'
  | 'other';

const TOOL_ACTIVITY_CATEGORIES = new Set<ToolActivityCategory>([
  'shell',
  'file_read',
  'file_write',
  'file_patch',
  'list',
  'find',
  'grep',
  'terminal',
  'other',
]);

function parseCategory(v: unknown): ToolActivityCategory | undefined {
  return typeof v === 'string' && TOOL_ACTIVITY_CATEGORIES.has(v as ToolActivityCategory)
    ? (v as ToolActivityCategory)
    : undefined;
}

export type TerminalAiToolStartEvent = {
  kind: 'tool_start';
  callId: string;
  toolName: string;
  title?: string;
  subtitle?: string;
  category?: ToolActivityCategory;
};

export type TerminalAiToolDoneStatus = 'ok' | 'error' | 'awaiting_approval';

export type TerminalAiToolDoneEvent = {
  kind: 'tool_done';
  callId: string;
  status: TerminalAiToolDoneStatus;
  preview?: string;
  error?: string;
  secretHint?: string;
  elapsedMs?: number;
};

export type TerminalAiApprovalEvent = {
  kind: 'approval_required';
  approvalId: string;
  tool: string;
  summary: string;
  riskHint?: string;
  callId?: string;
};

export type TerminalAiUsageEvent = {
  kind: 'usage';
  inputDelta: number;
  outputDelta: number;
};

export type TerminalAiGraphPhaseEvent = {
  kind: 'graph_phase';
  phase: 'model' | 'tool';
  detail?: string;
  langgraphNode?: string;
};

export type TerminalAiStreamEvent =
  | TerminalAiToolStartEvent
  | TerminalAiToolDoneEvent
  | TerminalAiApprovalEvent
  | TerminalAiUsageEvent
  | TerminalAiGraphPhaseEvent;

/** Handlers passed to `createAgentStreamFeed`. */
export type AgentStreamHandlers = {
  onVisible: (text: string) => void;
  onApproval: (event: TerminalAiApprovalEvent) => void;
  onToolStart: (event: TerminalAiToolStartEvent) => void;
  onToolDone: (event: TerminalAiToolDoneEvent) => void;
  onUsage: (event: TerminalAiUsageEvent) => void;
  onGraphPhase: (event: TerminalAiGraphPhaseEvent) => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function parseTerminalAiEventLine(line: string): TerminalAiStreamEvent | null {
  if (!line.startsWith(TERMINALAI_EVENT_PREFIX)) return null;
  try {
    const raw = JSON.parse(line.slice(TERMINALAI_EVENT_PREFIX.length)) as unknown;
    if (!isRecord(raw) || typeof raw.kind !== 'string') return null;
    if (raw.kind === 'approval_required') {
      if (typeof raw.approvalId !== 'string' || typeof raw.tool !== 'string' || typeof raw.summary !== 'string') {
        return null;
      }
      return {
        kind: 'approval_required',
        approvalId: raw.approvalId,
        tool: raw.tool,
        summary: raw.summary,
        riskHint: typeof raw.riskHint === 'string' ? raw.riskHint : undefined,
        callId: typeof raw.callId === 'string' ? raw.callId : undefined,
      };
    }
    if (raw.kind === 'tool_start') {
      if (typeof raw.callId !== 'string' || typeof raw.toolName !== 'string') return null;
      return {
        kind: 'tool_start',
        callId: raw.callId,
        toolName: raw.toolName,
        title: typeof raw.title === 'string' ? raw.title : undefined,
        subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
        category: parseCategory(raw.category),
      };
    }
    if (raw.kind === 'usage') {
      const inputDelta =
        typeof raw.inputDelta === 'number' && Number.isFinite(raw.inputDelta) && raw.inputDelta >= 0
          ? Math.floor(raw.inputDelta)
          : null;
      const outputDelta =
        typeof raw.outputDelta === 'number' && Number.isFinite(raw.outputDelta) && raw.outputDelta >= 0
          ? Math.floor(raw.outputDelta)
          : null;
      if (inputDelta == null || outputDelta == null) return null;
      return { kind: 'usage', inputDelta, outputDelta };
    }
    if (raw.kind === 'graph_phase') {
      if (raw.phase !== 'model' && raw.phase !== 'tool') return null;
      return {
        kind: 'graph_phase',
        phase: raw.phase,
        detail: typeof raw.detail === 'string' ? raw.detail : undefined,
        langgraphNode: typeof raw.langgraphNode === 'string' ? raw.langgraphNode : undefined,
      };
    }
    if (raw.kind === 'tool_done') {
      if (typeof raw.callId !== 'string' || typeof raw.status !== 'string') return null;
      const status = raw.status as TerminalAiToolDoneStatus;
      if (status !== 'ok' && status !== 'error' && status !== 'awaiting_approval') return null;
      const preview = typeof raw.preview === 'string' ? raw.preview : undefined;
      const error = typeof raw.error === 'string' ? raw.error : undefined;
      const secretHint = typeof raw.secretHint === 'string' ? raw.secretHint : undefined;
      const elapsedMs =
        typeof raw.elapsedMs === 'number' && Number.isFinite(raw.elapsedMs) && raw.elapsedMs >= 0
          ? Math.round(raw.elapsedMs)
          : undefined;
      return {
        kind: 'tool_done',
        callId: raw.callId,
        status,
        ...(preview !== undefined ? { preview } : {}),
        ...(error !== undefined ? { error } : {}),
        ...(secretHint !== undefined ? { secretHint } : {}),
        ...(elapsedMs !== undefined ? { elapsedMs } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export type AgentStreamFeed = {
  /** Append decoded UTF-8 chunk; invokes onVisible for text to show in chat. */
  push: (chunk: string) => void;
  /** Call when stream ends (flushes partial line as visible). */
  finish: () => void;
};

/**
 * In Vite dev (`import.meta.env.DEV`), logs tool_start / tool_done / approval_required with
 * elapsed ms (tool_done) to the browser console. No-op in production builds.
 */
export function withDevAgentStreamTelemetry(handlers: AgentStreamHandlers): AgentStreamHandlers {
  if (!import.meta.env.DEV) return handlers;

  const starts = new Map<string, { toolName: string; t: number }>();

  return {
    ...handlers,
    onToolStart(ev) {
      starts.set(ev.callId, { toolName: ev.toolName, t: performance.now() });
      console.debug(
        '[TerminalAI dev] tool_start',
        ev.toolName,
        ev.callId,
        ev.subtitle?.trim() || ev.title?.trim() || ''
      );
      handlers.onToolStart(ev);
    },
    onToolDone(ev) {
      const rec = starts.get(ev.callId);
      const clientMs = rec != null ? Math.round(performance.now() - rec.t) : undefined;
      starts.delete(ev.callId);
      const msLabel =
        ev.elapsedMs != null ? `${ev.elapsedMs}ms(srv)` : clientMs != null ? `${clientMs}ms` : '—';
      console.debug('[TerminalAI dev] tool_done', rec?.toolName ?? '?', ev.callId, ev.status, msLabel);
      handlers.onToolDone(ev);
    },
    onApproval(ev) {
      console.debug(
        '[TerminalAI dev] approval_required',
        ev.tool,
        ev.approvalId,
        ev.summary.length > 160 ? `${ev.summary.slice(0, 160)}…` : ev.summary
      );
      handlers.onApproval(ev);
    },
    onUsage(ev) {
      console.debug('[TerminalAI dev] usage', `+${ev.inputDelta} in`, `+${ev.outputDelta} out`);
      handlers.onUsage(ev);
    },
    onGraphPhase(ev) {
      console.debug('[TerminalAI dev] graph_phase', ev.phase, ev.detail ?? '', ev.langgraphNode ?? '');
      handlers.onGraphPhase(ev);
    },
  };
}

export function createAgentStreamFeed(handlers: AgentStreamHandlers): AgentStreamFeed {
  let pendingLine = '';

  function dispatchFullLine(line: string) {
    const ev = parseTerminalAiEventLine(line);
    if (ev) {
      if (ev.kind === 'approval_required') handlers.onApproval(ev);
      else if (ev.kind === 'tool_start') handlers.onToolStart(ev);
      else if (ev.kind === 'tool_done') handlers.onToolDone(ev);
      else if (ev.kind === 'usage') handlers.onUsage(ev);
      else if (ev.kind === 'graph_phase') handlers.onGraphPhase(ev);
      return;
    }
    handlers.onVisible(line + '\n');
  }

  return {
    push(chunk: string) {
      pendingLine += chunk;
      for (;;) {
        const nl = pendingLine.indexOf('\n');
        if (nl < 0) break;
        const line = pendingLine.slice(0, nl);
        pendingLine = pendingLine.slice(nl + 1);
        dispatchFullLine(line);
      }
    },
    finish() {
      if (pendingLine.length === 0) return;
      const line = pendingLine;
      pendingLine = '';
      const ev = parseTerminalAiEventLine(line);
      if (ev) {
        if (ev.kind === 'approval_required') handlers.onApproval(ev);
        else if (ev.kind === 'tool_start') handlers.onToolStart(ev);
        else if (ev.kind === 'tool_done') handlers.onToolDone(ev);
        else if (ev.kind === 'usage') handlers.onUsage(ev);
        else if (ev.kind === 'graph_phase') handlers.onGraphPhase(ev);
      } else handlers.onVisible(line);
    },
  };
}
