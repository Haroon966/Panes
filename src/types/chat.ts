import type { AgentTraceEntry } from './agentTrace';

export type ChatRole = 'user' | 'assistant' | 'system';

export type MessageAlternate = { id: string; content: string; createdAt: number };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Prior versions of this message (active text is always `content`). */
  alternates?: MessageAlternate[];
  /** Server `created_at` when loaded from persistence (used for ordering / truncation). */
  createdAt?: number;
  /** LangGraph tool / phase timeline for assistant turns (persisted when non-empty). */
  agentTrace?: AgentTraceEntry[];
}
