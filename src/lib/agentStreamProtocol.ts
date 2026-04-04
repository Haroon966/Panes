export const TERMINALAI_EVENT_PREFIX = 'TERMINALAI_EVENT:';

export type TerminalAiApprovalEvent = {
  kind: 'approval_required';
  approvalId: string;
  tool: string;
  summary: string;
  riskHint?: string;
};

export function parseTerminalAiEventLine(line: string): TerminalAiApprovalEvent | null {
  if (!line.startsWith(TERMINALAI_EVENT_PREFIX)) return null;
  try {
    const j = JSON.parse(line.slice(TERMINALAI_EVENT_PREFIX.length)) as TerminalAiApprovalEvent;
    if (j?.kind !== 'approval_required' || typeof j.approvalId !== 'string') return null;
    return j;
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

export function createAgentStreamFeed(handlers: {
  onVisible: (text: string) => void;
  onApproval: (event: TerminalAiApprovalEvent) => void;
}): AgentStreamFeed {
  let pendingLine = '';

  function dispatchFullLine(line: string) {
    const ev = parseTerminalAiEventLine(line);
    if (ev) {
      handlers.onApproval(ev);
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
      if (ev) handlers.onApproval(ev);
      else handlers.onVisible(line);
    },
  };
}
