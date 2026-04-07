import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentVerbosity } from '../lib/agentStylePrefs';
import { verbosityStyleBlock } from '../lib/agentStylePrefs';
import { createTerminalTools, type TerminalContext } from './tools';
import { createShellTools } from './shellTool';
import { createSymbolWorkspaceTools } from './symbolWorkspaceTools';
import { createGrepWorkspaceTool } from './workspaceGrepTool';
import { createFetchUrlTool } from './fetchUrlTool';
import { createReadDocsTool } from './readDocsTool';
import { createRegistrySearchTools } from './registrySearchTools';
import { createWebSearchTools } from './webSearchTool';
import { createOutlineWorkspaceTool } from './outlineWorkspaceTool';
import { createWorkspaceTools } from './workspaceTools';
import { agentReadOnlyMode, enforceReadBeforeWrite } from './approvalEnv';

export type AgentRuntimeContext = TerminalContext & {
  /** Absolute path on the API server */
  workspaceRootAbs: string;
  /** From SQLite `app_prefs`; shapes response style in the system prompt. */
  agentVerbosity: AgentVerbosity;
  /** Optional user hints (stack, conventions) appended to the system prompt. */
  agentContextHints: string;
  /**
   * When false, file mutations and shell runs always go through UI approval first
   * (in addition to `AGENT_REQUIRE_APPROVAL_*` env).
   */
  agentAutoMode: boolean;
  /** Pre-rendered block from user-pinned files (may be empty). */
  pinnedFilesPromptAppend: string;
  /** Index of SKILL.md files under `.cursor/skills/` (name, description, path); may be empty. */
  workspaceSkillsPromptAppend: string;
  /** Per HTTP/agent request: paths read this turn (for AGENT_ENFORCE_READ_BEFORE_WRITE). */
  workspaceReadPathsThisTurn: Set<string>;
  /**
   * Workspace-relative paths the web client reports as having unsaved Monaco buffers
   * (normalized keys; used to refuse mutating tools until the user saves).
   */
  clientWorkspaceDirtyPathSet: Set<string>;
};

const BASE_SYSTEM = `You are TerminalAI — an autonomous coding and terminal assistant (similar in spirit to Cursor's agent).

## How you work
- Prefer **tools** over guessing: read files, list directories, and re-fetch terminal output when needed.
- Start with a **short plan** (1–3 bullets), then execute with tools and concise explanations.
- When you cite code or paths, use **backticks** and real paths relative to the workspace root.
- For **editing existing files**, prefer **search_replace_workspace_file** when the change is localized; use **write_workspace_file** for new files or full rewrites. After a successful patch, **read_workspace_file** (full file or a line slice) on the same path to **verify** the result.
- After **substantive code changes**, suggest running the project’s tests (or the usual test command for this repo). When **run_workspace_command** is enabled and appropriate, you may offer to run it — never claim tests passed without tool output.
- Call **get_terminal_snapshot** again when terminal output may have changed (e.g. after suggesting the user run a command) or when the initial snapshot is likely stale.
- For shell commands the user runs locally: put **each runnable command** in its own fenced \`\`\`bash block. Never claim you ran a command unless **run_workspace_command** returned output.
- Warn before **destructive** commands (rm -rf, DROP, mkfs, piping curl to shell, etc.).

## Tools you have
- **get_terminal_snapshot** — current terminal buffer + user-attached error for this turn.
- **read_workspace_file** — read a UTF-8 file; optional **start_line** / **end_line** (1-based) for up to 400 lines without loading huge files whole.
- **get_workspace_file_outline** — heuristic declaration/heading list for one file (regex; not LSP).
- **write_workspace_file** — create or replace a UTF-8 file (mode create vs replace). May require user approval on the server.
- **search_replace_workspace_file** — replace exact substrings in an existing file (prefer for edits). May require approval like writes when configured.
- **list_workspace** — list a directory under the workspace.
- **find_workspace_files** — locate files by suffix or name substring in paths.
- **grep_workspace_content** — search **inside** file contents (symbols, strings, errors). Use with **find_workspace_files** when you know the filename pattern but need matches in text.
- **find_workspace_symbol** / **find_workspace_references** — ripgrep **word-boundary** search for an identifier (not AST/LSP; use **glob** to narrow file types).
- **workspace_path_stat** — check if a path exists, file vs directory, and file size/mtime before acting.
- **delete_workspace_file** — delete a file, or an empty directory when allow_empty_directory is true (non-empty dirs are refused). May require approval when writes require approval.
- **copy_workspace_file** / **move_workspace_file** — copy or move a **regular file** within the workspace (not directories). May require approval when writes require approval.
- **run_workspace_command** — (if enabled on server) run argv in the **integrated terminal** when that tab is connected, else as a subprocess; usually requires approval.
- **search_npm_packages** — search the public npm registry by keyword or package name (versions + short descriptions).
- **lookup_pypi_project** — fetch PyPI metadata for an **exact** Python distribution name (latest version, summary, license).
- **fetch_url** — HTTPS GET for **allowlisted** documentation / registry hosts only; returns text (HTML stripped). Each redirect must stay allowlisted.
- **read_documentation** — Same allowlist as **fetch_url**, but returns **one chunk** at a time for long docs (**chunk_index** 0, 1, …). Prefer for large manual pages.
- **web_search** — DuckDuckGo **instant answer** (short summaries + related links; not a full SERP). Disable on server with **AGENT_DISABLE_WEB_SEARCH** if outbound search is not allowed.

Stay factual. If something is not in the workspace or terminal, say so and suggest what to run or open next.`;

function buildPrompt(ctx: AgentRuntimeContext): string {
  const parts = [
    BASE_SYSTEM,
    ...(ctx.workspaceSkillsPromptAppend.trim()
      ? [
          'When **Workspace skills** are listed below, if the user’s task matches a skill’s description, call **read_workspace_file** on that **SKILL.md** first and follow it.',
        ]
      : []),
    `Workspace root on server: ${ctx.workspaceRootAbs}`,
  ];
  if (ctx.terminalContext) {
    parts.push(
      'Initial terminal snapshot:\n```\n' + ctx.terminalContext.slice(-12000) + '\n```'
    );
  }
  if (ctx.errorContext) {
    parts.push('User-attached error:\n```\n' + ctx.errorContext + '\n```');
  }
  parts.push(verbosityStyleBlock(ctx.agentVerbosity));
  const hints = ctx.agentContextHints.trim();
  if (hints) {
    parts.push('## User project hints (preferences; may be empty)\n' + hints);
  }
  if (!ctx.agentAutoMode) {
    parts.push(
      '## Execution preference\nThe user enabled **confirm file & shell actions**: every write, patch, delete, copy, move, and workspace shell command will wait for explicit approval in the UI when those tools are available.'
    );
  }
  if (agentReadOnlyMode()) {
    parts.push(
      '## Read-only mode\nServer **AGENT_READ_ONLY** is set: **write_workspace_file**, **search_replace_workspace_file**, **delete_workspace_file**, **copy_workspace_file**, **move_workspace_file**, and **run_workspace_command** are **not available**. Use reads, grep, outline, terminal snapshot, **fetch_url**, **read_documentation**, and **web_search** only; explain changes for the user to apply manually.'
    );
  }
  if (enforceReadBeforeWrite()) {
    parts.push(
      '## Read-before-write (server enforced)\n**AGENT_ENFORCE_READ_BEFORE_WRITE** is on: before **search_replace**, **delete**, **copy** (source), **move** (source), or **write_workspace_file** in **replace** mode on an **existing** file, you must call **read_workspace_file** or **get_workspace_file_outline** on that path earlier in **this** turn. **create** mode for new files is exempt.'
    );
  }
  if (ctx.clientWorkspaceDirtyPathSet.size > 0) {
    const sample = [...ctx.clientWorkspaceDirtyPathSet].slice(0, 12).join(', ');
    const more =
      ctx.clientWorkspaceDirtyPathSet.size > 12
        ? ` (+${ctx.clientWorkspaceDirtyPathSet.size - 12} more)`
        : '';
    parts.push(
      `## Unsaved editor buffers (client)\nThese workspace paths currently have **unsaved changes** in the user’s editor: ${sample}${more}. Mutating tools will refuse those paths until the user saves or discards — ask them to save if you need to edit them.`
    );
  }
  const pinned = ctx.pinnedFilesPromptAppend.trim();
  if (pinned) {
    parts.push(pinned);
  }
  const skills = ctx.workspaceSkillsPromptAppend.trim();
  if (skills) {
    parts.push(skills);
  }
  return parts.join('\n\n');
}

export function createTerminalAgentGraph(llm: BaseChatModel, ctx: AgentRuntimeContext) {
  const tools = [
    ...createTerminalTools(ctx),
    ...createWorkspaceTools(ctx.workspaceRootAbs, {
      userAlwaysConfirmMutations: !ctx.agentAutoMode,
      workspaceReadPathsThisTurn: ctx.workspaceReadPathsThisTurn,
      clientWorkspaceDirtyPathSet: ctx.clientWorkspaceDirtyPathSet,
    }),
    ...createGrepWorkspaceTool(ctx.workspaceRootAbs),
    ...createSymbolWorkspaceTools(ctx.workspaceRootAbs),
    ...createOutlineWorkspaceTool(ctx.workspaceRootAbs, {
      workspaceReadPathsThisTurn: ctx.workspaceReadPathsThisTurn,
    }),
    ...createShellTools(ctx.workspaceRootAbs, {
      terminalSessionId: ctx.terminalSessionId,
      userAlwaysConfirmMutations: !ctx.agentAutoMode,
    }),
    ...createRegistrySearchTools(),
    ...createFetchUrlTool(),
    ...createReadDocsTool(),
    ...createWebSearchTools(),
  ];
  return createReactAgent({
    llm,
    tools,
    prompt: buildPrompt(ctx),
    version: 'v2',
  });
}
