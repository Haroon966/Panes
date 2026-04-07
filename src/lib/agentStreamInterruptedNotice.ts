/** sessionStorage flag when the tab was closed or refreshed while an agent stream was active. */

export const AGENT_STREAM_INTERRUPTED_KEY = 'terminalai-agent-stream-interrupted-v1';

export const AGENT_STREAM_INTERRUPTED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type AgentStreamInterruptedPayload = {
  conversationId: string;
  at: number;
};

export function readAgentStreamInterruptedNotice(): AgentStreamInterruptedPayload | null {
  try {
    const raw = sessionStorage.getItem(AGENT_STREAM_INTERRUPTED_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { conversationId?: unknown; at?: unknown };
    if (typeof j.conversationId !== 'string' || typeof j.at !== 'number') return null;
    if (Date.now() - j.at > AGENT_STREAM_INTERRUPTED_MAX_AGE_MS) {
      sessionStorage.removeItem(AGENT_STREAM_INTERRUPTED_KEY);
      return null;
    }
    return { conversationId: j.conversationId, at: j.at };
  } catch {
    return null;
  }
}

export function clearAgentStreamInterruptedNotice(): void {
  try {
    sessionStorage.removeItem(AGENT_STREAM_INTERRUPTED_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function recordAgentStreamInterrupted(conversationId: string): void {
  try {
    sessionStorage.setItem(
      AGENT_STREAM_INTERRUPTED_KEY,
      JSON.stringify({ conversationId, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}
