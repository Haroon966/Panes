/**
 * Human-readable summaries for “what is the agent doing?” (chat UI tooltips).
 * Kept free of React / Zustand so it stays easy to test.
 */

export type AgentActivityToolRow = {
  toolName: string;
  phase: 'running' | 'awaiting_approval' | 'done' | 'error';
  title?: string;
};

export function humanizeAgentToolName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Short sentence for tooltips / `title` while the agent stream is active.
 * Returns null when not streaming.
 */
export function describeAgentLiveActivity(input: {
  isStreaming: boolean;
  activeToolCalls: AgentActivityToolRow[];
  pendingHitlCount: number;
  /** From `graph_phase` stream events (LangGraph agent); Cline omits. */
  graphPhase?: { phase: 'model' | 'tool'; detail?: string; langgraphNode?: string } | null;
}): string | null {
  if (!input.isStreaming) return null;
  const rows = input.activeToolCalls;
  const awaitingInTools = rows.filter((c) => c.phase === 'awaiting_approval');
  if (awaitingInTools.length > 0) {
    const t = awaitingInTools[awaitingInTools.length - 1]!;
    const label = t.title?.trim() || humanizeAgentToolName(t.toolName);
    return `Waiting for your approval before: ${label}.`;
  }
  if (input.pendingHitlCount > 0) {
    return `Waiting for your approval (${input.pendingHitlCount} pending). Check the approval card below.`;
  }
  const running = rows.filter((c) => c.phase === 'running');
  if (running.length > 0) {
    const t = running[running.length - 1]!;
    const label = t.title?.trim() || humanizeAgentToolName(t.toolName);
    if (running.length === 1) return `Running: ${label}.`;
    return `Running ${running.length} tools; latest: ${label}.`;
  }
  const gp = input.graphPhase;
  if (gp?.phase === 'tool' && gp.detail?.trim()) {
    return `Running: ${humanizeAgentToolName(gp.detail.trim())}.`;
  }
  if (gp?.phase === 'model') {
    const node = gp.langgraphNode?.trim();
    return node && node !== 'agent'
      ? `Model step (${node}): generating a reply.`
      : 'The model is generating a reply.';
  }
  return 'The model is reasoning or streaming its reply. Open the Tools section above for step details.';
}
