import {
  AIMessageChunk,
  HumanMessage,
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { createChatModel, type ModelRequestAuth } from '../lib/chatModelFactory';
import { loadAgentRuntimePrefs } from '../lib/agentStylePrefs';
import { buildPinnedFilesPromptAppend } from './pinnedFilesPrompt';
import { buildWorkspaceSkillsPromptAppend } from './workspaceSkillsPrompt';
import { createTerminalAgentGraph, type AgentRuntimeContext } from './graph';
import { resolveEffectiveWorkspaceRoot } from './workspaceRoot';
import type { TerminalContext } from './tools';
import { formatTerminalAiEvent, type TerminalAiApprovalEvent } from './streamProtocol';
import { toolActivityFromToolStart } from './toolActivityFromInput';
import {
  parseToolRepeatGuardLimit,
  toolStartFingerprint,
  updateRepeatStreak,
} from './toolRepeatGuard';
import { formatSecretRedactionHint, redactLikelySecrets } from '../lib/agentSecretLeak';
import {
  buildClientWorkspaceDirtyPathSet,
  sanitizeClientWorkspaceDirtyPaths,
} from './workspaceClientDirtyPaths';

export type AgentMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function toBaseMessages(msgs: AgentMessage[]): BaseMessage[] {
  return msgs.map((m) => {
    if (m.role === 'user') return new HumanMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    return new SystemMessage(m.content);
  });
}

/** Pull LangChain-reported token counts from `on_chat_model_end` payload when present. */
function extractUsageDeltaFromChatModelEnd(data: unknown): { input: number; output: number } | null {
  const output = (data as { output?: AIMessage })?.output;
  if (!output || typeof output !== 'object') return null;
  const u = output.usage_metadata;
  if (!u || typeof u !== 'object') return null;
  const input = (u as { input_tokens?: unknown }).input_tokens;
  const outTok = (u as { output_tokens?: unknown }).output_tokens;
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  if (typeof outTok !== 'number' || !Number.isFinite(outTok)) return null;
  return {
    input: Math.max(0, Math.floor(input)),
    output: Math.max(0, Math.floor(outTok)),
  };
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
): {
  id: string;
  relative_path?: string;
  bytes?: number;
  command?: string;
  patch_preview?: string;
  source_path?: string;
  dest_path?: string;
  allow_empty_directory?: boolean;
  overwrite?: boolean;
} | null {
  const raw = toolEndOutputToString(output);
  const prefix = 'PENDING_APPROVAL:';
  if (!raw.startsWith(prefix)) return null;
  try {
    return JSON.parse(raw.slice(prefix.length)) as {
      id: string;
      relative_path?: string;
      bytes?: number;
      command?: string;
      patch_preview?: string;
      source_path?: string;
      dest_path?: string;
      allow_empty_directory?: boolean;
      overwrite?: boolean;
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
  /**
   * Ephemeral instruction for this completion only (prepended as a system line; not persisted).
   * Used for “rewrite response” without adding a visible user message.
   */
  regenerationHint?: string;
  /** Client-reported workspace-relative paths with unsaved Monaco buffers (mutating tools refuse them). */
  workspaceDirtyPaths?: unknown;
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
  const dirtySanitized = sanitizeClientWorkspaceDirtyPaths(params.workspaceDirtyPaths);
  const clientWorkspaceDirtyPathSet = buildClientWorkspaceDirtyPathSet(workspaceRootAbs, dirtySanitized);
  const prefs = loadAgentRuntimePrefs();
  const [pinnedFilesPromptAppend, workspaceSkillsPromptAppend] = await Promise.all([
    buildPinnedFilesPromptAppend(workspaceRootAbs, prefs.agentPinnedPaths),
    buildWorkspaceSkillsPromptAppend(workspaceRootAbs),
  ]);
  const workspaceReadPathsThisTurn = new Set<string>();
  const runtimeCtx: AgentRuntimeContext = {
    ...params.ctx,
    workspaceRootAbs,
    agentVerbosity: prefs.agentVerbosity,
    agentContextHints: prefs.agentContextHints,
    agentAutoMode: prefs.agentAutoMode,
    agentVerifyCommand: prefs.agentVerifyCommand,
    pinnedFilesPromptAppend,
    workspaceSkillsPromptAppend,
    workspaceReadPathsThisTurn,
    clientWorkspaceDirtyPathSet,
  };
  const graph = createTerminalAgentGraph(llm, runtimeCtx);

  let agentMessages = params.messages;
  const hint = params.regenerationHint?.trim();
  if (hint) {
    agentMessages = [
      {
        role: 'system' as const,
        content:
          '[One-time instruction for this reply only — apply it to your next response, then disregard for later turns.]\n' +
          hint,
      },
      ...agentMessages,
    ];
  }

  const eventStream = await graph.streamEvents(
    { messages: toBaseMessages(agentMessages) },
    {
      version: 'v2',
      recursionLimit: defaultRecursionLimit(),
      signal: params.signal,
    }
  );

  let toolSeq = 0;
  const toolCallStack: string[] = [];
  const toolStartMs = new Map<string, number>();
  const repeatGuardLimit = parseToolRepeatGuardLimit();
  const repeatStreak = { lastFingerprint: '', count: 0 };
  /** Emit `graph_phase: model` once per model streaming burst (avoids per-chunk spam). */
  let inModelStreamingBurst = false;

  const takeToolElapsedMs = (callId: string): number | undefined => {
    const t0 = toolStartMs.get(callId);
    toolStartMs.delete(callId);
    if (t0 == null) return undefined;
    return Math.max(0, Math.round(Date.now() - t0));
  };

  for await (const event of eventStream) {
    const ev = event.event as string;
    const toolName =
      (typeof event.name === 'string' && event.name) ||
      (typeof (event.metadata as { tool?: string } | undefined)?.tool === 'string'
        ? (event.metadata as { tool: string }).tool
        : '');

    if (ev === 'on_tool_start' && toolName) {
      const lgNodeTool =
        typeof (event.metadata as { langgraph_node?: unknown } | undefined)?.langgraph_node ===
        'string'
          ? String((event.metadata as { langgraph_node: string }).langgraph_node)
          : undefined;
      yield formatTerminalAiEvent({
        kind: 'graph_phase',
        phase: 'tool',
        detail: toolName,
        ...(lgNodeTool ? { langgraphNode: lgNodeTool } : {}),
      });
      inModelStreamingBurst = false;
      const rawInput = (event.data as { input?: unknown })?.input;
      if (repeatGuardLimit > 0) {
        const fp = toolStartFingerprint(toolName, rawInput);
        if (updateRepeatStreak(repeatStreak, fp, repeatGuardLimit)) {
          yield `\n\n[TerminalAI] Stopped: **${toolName}** reached **${repeatGuardLimit}** consecutive identical invocations (set AGENT_TOOL_REPEAT_GUARD=0 to disable).\n`;
          throw new DOMException('Agent tool repeat guard', 'AbortError');
        }
      }
      const callId = `tc_${++toolSeq}`;
      toolCallStack.push(callId);
      toolStartMs.set(callId, Date.now());
      const activity = toolActivityFromToolStart(toolName, rawInput);
      yield formatTerminalAiEvent({
        kind: 'tool_start',
        callId,
        toolName,
        ...activity,
      });
      continue;
    }

    if (ev === 'on_tool_end' && toolName) {
      const callId = toolCallStack.pop() ?? `tc_${++toolSeq}`;
      const elapsedMs = takeToolElapsedMs(callId);
      const out = (event.data as { output?: unknown })?.output;
      const pending = pendingApprovalPayload(out);
      if (pending?.id) {
        let summary = `Approve ${toolName}`;
        if (toolName === 'write_workspace_file' && pending.relative_path != null) {
          summary = `Write **${pending.relative_path}** (${pending.bytes ?? '?'} bytes)`;
        } else if (
          toolName === 'search_replace_workspace_file' &&
          pending.relative_path != null
        ) {
          const pv = pending.patch_preview;
          summary = pv
            ? `Patch **${pending.relative_path}** — \`${truncateForStream(pv, 160)}\``
            : `Patch **${pending.relative_path}** (${pending.bytes ?? '?'} bytes)`;
        } else if (
          (toolName === 'run_workspace_command' || toolName === 'run_project_verify_command') &&
          pending.command != null
        ) {
          summary =
            toolName === 'run_project_verify_command'
              ? `Verify: \`${truncateForStream(pending.command, 200)}\``
              : `Run: \`${truncateForStream(pending.command, 200)}\``;
        } else if (toolName === 'delete_workspace_file' && pending.relative_path != null) {
          summary = pending.allow_empty_directory
            ? `Delete empty directory **${pending.relative_path}**`
            : `Delete file **${pending.relative_path}**`;
        } else if (
          toolName === 'copy_workspace_file' &&
          pending.source_path != null &&
          pending.dest_path != null
        ) {
          summary = `Copy **${pending.source_path}** → **${pending.dest_path}**`;
        } else if (
          toolName === 'move_workspace_file' &&
          pending.source_path != null &&
          pending.dest_path != null
        ) {
          summary = `Move **${pending.source_path}** → **${pending.dest_path}**`;
        }
        const evt: TerminalAiApprovalEvent = {
          kind: 'approval_required',
          approvalId: pending.id,
          tool: toolName,
          summary,
          callId,
          riskHint:
            toolName === 'run_workspace_command' || toolName === 'run_project_verify_command'
              ? 'Shell commands can change your system; review carefully.'
              : toolName === 'write_workspace_file'
                ? 'Overwrites existing files when mode is replace.'
                : toolName === 'search_replace_workspace_file'
                  ? 'Replaces matched text in the file; verify the preview matches your intent.'
                  : toolName === 'delete_workspace_file'
                    ? 'Permanently removes the path from disk.'
                    : toolName === 'copy_workspace_file'
                      ? pending.overwrite
                        ? 'Overwrites the destination file if it exists.'
                        : undefined
                      : toolName === 'move_workspace_file'
                        ? pending.overwrite
                          ? 'Overwrites the destination file if it exists.'
                          : 'Source file will no longer exist at the original path.'
                        : undefined,
        };
        yield formatTerminalAiEvent(evt);
        yield formatTerminalAiEvent({
          kind: 'tool_done',
          callId,
          status: 'awaiting_approval',
          ...(elapsedMs != null ? { elapsedMs } : {}),
        });
      } else {
        const textOut = toolEndOutputToString(out);
        if (textOut) {
          const truncated = truncateForStream(textOut);
          const { text: preview, labels } = redactLikelySecrets(truncated);
          const secretHint = formatSecretRedactionHint(labels);
          yield formatTerminalAiEvent({
            kind: 'tool_done',
            callId,
            status: 'ok',
            preview,
            ...(secretHint ? { secretHint } : {}),
            ...(elapsedMs != null ? { elapsedMs } : {}),
          });
        } else {
          yield formatTerminalAiEvent({
            kind: 'tool_done',
            callId,
            status: 'ok',
            ...(elapsedMs != null ? { elapsedMs } : {}),
          });
        }
      }
      continue;
    }

    if (ev === 'on_tool_error' && toolName) {
      const callId = toolCallStack.length > 0 ? toolCallStack.pop()! : `tc_${++toolSeq}`;
      const errElapsedMs = takeToolElapsedMs(callId);
      const err = (event.data as { error?: unknown })?.error;
      const msg = err instanceof Error ? err.message : String(err ?? 'tool error');
      const truncatedErr = truncateForStream(msg, 500);
      const { text: errorOut, labels: errLabels } = redactLikelySecrets(truncatedErr);
      const errHint = formatSecretRedactionHint(errLabels);
      yield formatTerminalAiEvent({
        kind: 'tool_done',
        callId,
        status: 'error',
        error: errorOut,
        ...(errHint ? { secretHint: errHint } : {}),
        ...(errElapsedMs != null ? { elapsedMs: errElapsedMs } : {}),
      });
      continue;
    }

    if (ev === 'on_chat_model_end') {
      const nodeEnd = event.metadata?.langgraph_node as string | undefined;
      if (nodeEnd != null && nodeEnd !== 'agent') continue;
      const delta = extractUsageDeltaFromChatModelEnd(event.data);
      if (delta != null && (delta.input > 0 || delta.output > 0)) {
        yield formatTerminalAiEvent({
          kind: 'usage',
          inputDelta: delta.input,
          outputDelta: delta.output,
        });
      }
      continue;
    }

    if (ev !== 'on_chat_model_stream') continue;
    const node = event.metadata?.langgraph_node as string | undefined;
    if (node != null && node !== 'agent') continue;
    if (!inModelStreamingBurst) {
      yield formatTerminalAiEvent({
        kind: 'graph_phase',
        phase: 'model',
        ...(node ? { langgraphNode: node } : {}),
      });
      inModelStreamingBurst = true;
    }
    const text = chunkToText(event.data?.chunk);
    if (text) yield text;
  }
}
