/** Prefix for machine-readable lines embedded in agent text streams (client strips / handles). */
export const TERMINALAI_EVENT_PREFIX = 'TERMINALAI_EVENT:';

export type TerminalAiApprovalEvent = {
  kind: 'approval_required';
  approvalId: string;
  tool: string;
  summary: string;
  riskHint?: string;
};

export function formatTerminalAiEvent(event: TerminalAiApprovalEvent): string {
  return `${TERMINALAI_EVENT_PREFIX}${JSON.stringify(event)}\n`;
}
