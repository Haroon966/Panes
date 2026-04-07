import { getDb } from '../db/client';

export const AGENT_VERBOSITY_VALUES = ['concise', 'detailed', 'step_by_step'] as const;
export type AgentVerbosity = (typeof AGENT_VERBOSITY_VALUES)[number];

export const DEFAULT_AGENT_VERBOSITY: AgentVerbosity = 'detailed';

export function normalizeAgentVerbosity(raw: string | null | undefined): AgentVerbosity {
  const v = (raw ?? '').trim();
  return (AGENT_VERBOSITY_VALUES as readonly string[]).includes(v)
    ? (v as AgentVerbosity)
    : DEFAULT_AGENT_VERBOSITY;
}

const MAX_AGENT_CONTEXT_HINTS = 4000;

export const MAX_AGENT_PINNED_PATHS = 8;
export const MAX_AGENT_PINNED_PATH_LEN = 512;

/** Normalize pinned paths from API/PUT body. */
export function normalizeAgentPinnedPathsArray(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  const out: string[] = [];
  for (const x of paths) {
    if (typeof x !== 'string') continue;
    const t = x.trim().replace(/\\/g, '/');
    if (!t || t.length > MAX_AGENT_PINNED_PATH_LEN) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_AGENT_PINNED_PATHS) break;
  }
  return out;
}

export function normalizeAgentPinnedPathsFromJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    return normalizeAgentPinnedPathsArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function normalizeAgentContextHints(raw: string | null | undefined): string {
  const t = (raw ?? '').replace(/\r\n/g, '\n');
  return t.length > MAX_AGENT_CONTEXT_HINTS ? t.slice(0, MAX_AGENT_CONTEXT_HINTS) : t;
}

export function verbosityStyleBlock(verbosity: AgentVerbosity): string {
  switch (verbosity) {
    case 'concise':
      return `## Response style (user preference)
Be brief: short answers, minimal preamble, no long recaps. Prefer bullets and code over prose.`;
    case 'step_by_step':
      return `## Response style (user preference)
Use numbered steps for plans and major actions. After each tool batch, briefly state what you learned and the next step.`;
    case 'detailed':
    default:
      return `## Response style (user preference)
Explain reasoning and tradeoffs where helpful; stay grounded in tool output and the workspace.`;
  }
}

/** SQLite `agent_mode`: 1 = auto (follow env HITL only), 0 = always confirm file/shell mutations in UI. */
export function loadAgentRuntimePrefs(db = getDb()): {
  agentVerbosity: AgentVerbosity;
  agentContextHints: string;
  agentAutoMode: boolean;
  agentPinnedPaths: string[];
} {
  const row = db
    .prepare(
      `SELECT agent_verbosity, agent_context_hints, agent_mode, agent_pinned_paths_json
       FROM app_prefs WHERE id = 1`
    )
    .get() as
      | {
          agent_verbosity: string;
          agent_context_hints: string;
          agent_mode: number;
          agent_pinned_paths_json: string;
        }
      | undefined;
  const mode = row?.agent_mode;
  return {
    agentVerbosity: normalizeAgentVerbosity(row?.agent_verbosity),
    agentContextHints: normalizeAgentContextHints(row?.agent_context_hints),
    agentAutoMode: mode === undefined ? true : mode === 1,
    agentPinnedPaths: normalizeAgentPinnedPathsFromJson(row?.agent_pinned_paths_json),
  };
}
