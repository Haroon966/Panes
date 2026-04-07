import type { ChatMessage } from '@/types/chat';

/** Payload for `/api/agent` — omits a trailing empty assistant placeholder used for live trace UI. */
export function messagesForAgentRequest(
  messages: ChatMessage[]
): { role: 'user' | 'assistant' | 'system'; content: string }[] {
  const last = messages[messages.length - 1];
  if (last?.role === 'assistant' && last.content.trim() === '') {
    return messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  }
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
