/** Prefix for machine-readable lines embedded in agent text streams (client strips / handles). */
export const TERMINALAI_EVENT_PREFIX = 'TERMINALAI_EVENT:';

/** UI grouping for tool activity rows (icons / styling). */
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

export type TerminalAiToolStartEvent = {
  kind: 'tool_start';
  callId: string;
  toolName: string;
  /** Human-readable primary line (e.g. “Read file”). */
  title?: string;
  /** Secondary detail: path, command, pattern (truncated server-side). */
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
  /** Present when preview/error had likely secrets redacted (see `agentSecretLeak.ts`). */
  secretHint?: string;
  /** Wall time from matching `tool_start` to this event (ms), when known. */
  elapsedMs?: number;
};

export type TerminalAiApprovalEvent = {
  kind: 'approval_required';
  approvalId: string;
  tool: string;
  summary: string;
  riskHint?: string;
  /** Correlates with {@link TerminalAiToolStartEvent.callId} for inline tool UI. */
  callId?: string;
};

/** One chat-model completion’s reported token counts (from LangChain `usage_metadata` when the provider sends it). */
export type TerminalAiUsageEvent = {
  kind: 'usage';
  inputDelta: number;
  outputDelta: number;
};

/** Coarse LangGraph / agent loop phase for live UI (not a full node DAG). */
export type TerminalAiGraphPhaseEvent = {
  kind: 'graph_phase';
  phase: 'model' | 'tool';
  /** When `phase === 'tool'`, the tool name (e.g. `read_workspace_file`). */
  detail?: string;
  /** Raw `langgraph_node` from stream metadata when present (often `agent`). */
  langgraphNode?: string;
};

export type TerminalAiStreamEvent =
  | TerminalAiToolStartEvent
  | TerminalAiToolDoneEvent
  | TerminalAiApprovalEvent
  | TerminalAiUsageEvent
  | TerminalAiGraphPhaseEvent;

export function formatTerminalAiEvent(event: TerminalAiStreamEvent): string {
  return `${TERMINALAI_EVENT_PREFIX}${JSON.stringify(event)}\n`;
}
