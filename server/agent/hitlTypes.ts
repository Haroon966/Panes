/**
 * Types for future human-in-the-loop (HITL) tool execution (Cline-like approvals).
 * LangGraph can use interrupts/checkpointers to pause until the UI posts a decision.
 */
export type PendingToolApproval = {
  id: string;
  toolName: string;
  summary: string;
  createdAt: number;
};

export type AgentHitlStatusResponse = {
  supported: boolean;
  phase: string;
  message: string;
};
