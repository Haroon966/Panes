import {
  AIMessageChunk,
  HumanMessage,
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createChatModel, type ModelRequestAuth } from '../lib/chatModelFactory';
import { createTerminalAgentGraph, type AgentRuntimeContext } from './graph';
import { resolveEffectiveWorkspaceRoot } from './workspaceRoot';
import type { TerminalContext } from './tools';
import { formatTerminalAiEvent, type TerminalAiApprovalEvent } from './streamProtocol';

export type AgentMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function toBaseMessages(msgs: AgentMessage[]): BaseMessage[] {
  return msgs.map((m) => {
    if (m.role === 'user') return new HumanMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    return new SystemMessage(m.content);
  });
}

function chunkToText(chunk: unknown): string {
  if (!chunk || typeof chunk !== 'object' || !('content' in chunk)) return '';
  const content = (chunk as AIMessageChunk).content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: unknown) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text: string }).text);
      }
      return '';
    })
    .join('');
}

const MAX_TOOL_OUTPUT_IN_STREAM = Math.min(
  4000,
  Math.max(200, Number(process.env.AGENT_TOOL_OUTPUT_STREAM_MAX) || 1200)
);

function truncateForStream(s: string, max = MAX_TOOL_OUTPUT_IN_STREAM): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated ${s.length - max} chars]`;
}

function pendingApprovalPayload(
  output: unknown
): { id: string; relative_path?: string; bytes?: number; command?: string } | null {
  const raw = toolEndOutputToString(output);
  const prefix = 'PENDING_APPROVAL:';
  if (!raw.startsWith(prefix)) return null;
  try {
    return JSON.parse(raw.slice(prefix.length)) as {
      id: string;
      relative_path?: string;
      bytes?: number;
      command?: string;
    };
  } catch {
    return null;
  }
}

/** Normalize LangGraph tool return values (string, ToolMessage, serialized lc message) for display. */
function toolEndOutputToString(out: unknown): string {
  if (typeof out === 'string') return out;
  if (out == null) return '';
  if (typeof out === 'object') {
    const o = out as Record<string, unknown>;
    if (typeof o.content === 'string') return o.content;
    if (Array.isArray(o.content)) {
      return o.content
        .map((p: unknown) => {
          if (typeof p === 'string') return p;
          if (p && typeof p === 'object' && 'text' in p) return String((p as { text: string }).text);
          return '';
        })
        .join('');
    }
    const kwargs = o.kwargs as Record<string, unknown> | undefined;
    if (kwargs && typeof kwargs.content === 'string') return kwargs.content;
  }
  try {
    return JSON.stringify(out);
  } catch {
    return String(out);
  }
}

function defaultRecursionLimit(): number {
  const fromEnv = Number(process.env.AGENT_RECURSION_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv >= 4) {
    return Math.min(80, fromEnv);
  }
  const steps = Math.min(20, Math.max(1, Number(process.env.AGENT_MAX_STEPS) || 5));
  return Math.min(50, Math.max(12, steps * 4));
}

export async function* streamAgentPlainText(params: {
  /** Required when {@link params.llm} is omitted. */
  auth?: ModelRequestAuth;
  messages: AgentMessage[];
  ctx: TerminalContext;
  /** Optional absolute workspace path from the client (same machine as the API server). */
  workspaceRootHint?: string;
  signal?: AbortSignal;
  /** If omitted, built from {@link params.auth} (which must be set). */
  llm?: BaseChatModel;
}): AsyncGenerator<string, void, void> {
  const llm =
    params.llm ??
    (params.auth ? createChatModel(params.auth) : (() => {
      throw new Error('streamAgentPlainText: pass either llm or auth');
    })());
  const workspaceRootAbs = resolveEffectiveWorkspaceRoot({
    workspaceRootHint: params.workspaceRootHint,
    terminalSessionId: params.ctx.terminalSessionId,
  });
  const runtimeCtx: AgentRuntimeContext = {
    ...params.ctx,
    workspaceRootAbs,
  };
  const graph = createTerminalAgentGraph(llm, runtimeCtx);

  const eventStream = await graph.streamEvents(
    { messages: toBaseMessages(params.messages) },
    {
      version: 'v2',
      recursionLimit: defaultRecursionLimit(),
      signal: params.signal,
    }
  );

  for await (const event of eventStream) {
    const ev = event.event as string;
    const toolName =
      (typeof event.name === 'string' && event.name) ||
      (typeof (event.metadata as { tool?: string } | undefined)?.tool === 'string'
        ? (event.metadata as { tool: string }).tool
        : '');

    if (ev === 'on_tool_start' && toolName) {
      yield `\n\n> **Tool:** \`${toolName}\`\n\n`;
      continue;
    }

    if (ev === 'on_tool_end' && toolName) {
      const out = (event.data as { output?: unknown })?.output;
      const pending = pendingApprovalPayload(out);
      if (pending?.id) {
        let summary = `Approve ${toolName}`;
        if (toolName === 'write_workspace_file' && pending.relative_path != null) {
          summary = `Write **${pending.relative_path}** (${pending.bytes ?? '?'} bytes)`;
        } else if (toolName === 'run_workspace_command' && pending.command != null) {
          summary = `Run: \`${truncateForStream(pending.command, 200)}\``;
        }
        const evt: TerminalAiApprovalEvent = {
          kind: 'approval_required',
          approvalId: pending.id,
          tool: toolName,
          summary,
          riskHint:
            toolName === 'run_workspace_command'
              ? 'Shell commands can change your system; review carefully.'
              : toolName === 'write_workspace_file'
                ? 'Overwrites existing files when mode is replace.'
                : undefined,
        };
        yield formatTerminalAiEvent(evt);
      } else {
        const textOut = toolEndOutputToString(out);
        if (textOut) {
          yield `\n\n*Done* — ${truncateForStream(textOut)}\n\n`;
        }
      }
      continue;
    }

    if (ev === 'on_tool_error' && toolName) {
      const err = (event.data as { error?: unknown })?.error;
      const msg = err instanceof Error ? err.message : String(err ?? 'tool error');
      yield `\n\n**Tool error** (\`${toolName}\`): ${truncateForStream(msg, 500)}\n\n`;
      continue;
    }

    if (ev !== 'on_chat_model_stream') continue;
    const node = event.metadata?.langgraph_node as string | undefined;
    if (node != null && node !== 'agent') continue;
    const text = chunkToText(event.data?.chunk);
    if (text) yield text;
  }
}
