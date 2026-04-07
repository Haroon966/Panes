import type { Request, Response } from 'express';

const CHAT_ROLES = new Set(['user', 'assistant', 'system']);

/** Returned when `messages` is missing, not an array, or empty (shared by both agent POST routes). */
export const CHAT_MESSAGES_REQUIRED = 'messages are required';

/**
 * Validates chat `messages` for POST /api/agent.
 * @returns `null` if valid; otherwise an error string (use {@link CHAT_MESSAGES_REQUIRED} for empty/missing).
 */
export function getChatMessagesValidationError(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return CHAT_MESSAGES_REQUIRED;
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      return `messages[${i}] must be an object`;
    }
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (typeof role !== 'string' || !CHAT_ROLES.has(role)) {
      return `messages[${i}].role must be user, assistant, or system`;
    }
    if (typeof content !== 'string') {
      return `messages[${i}].content must be a string`;
    }
  }
  return null;
}

/** How the response body is produced (exposed as `X-TerminalAI-Stream-Kind`). */
export type AgentTextStreamKind = 'langgraph';

/**
 * Sets plain-text stream headers, `X-TerminalAI-Stream-Kind`, and aborts when the client drops the
 * response. Uses `res.on('close')` (not `req.on('close')`) so a normal POST body end does not abort
 * before tokens stream. Call `dispose()` in a `finally` block after streaming completes.
 */
export function attachAgentTextStream(
  req: Request,
  res: Response,
  kind: AgentTextStreamKind
): { signal: AbortSignal; dispose: () => void } {
  const ac = new AbortController();
  const onResClose = () => {
    if (!res.writableEnded) {
      ac.abort();
    }
  };
  const onReqAborted = () => ac.abort();
  res.on('close', onResClose);
  req.on('aborted', onReqAborted);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-TerminalAI-Stream-Kind', kind);

  const dispose = () => {
    res.off('close', onResClose);
    req.off('aborted', onReqAborted);
  };
  return { signal: ac.signal, dispose };
}
