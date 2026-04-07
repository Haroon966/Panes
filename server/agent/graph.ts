import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { StructuredToolInterface } from '@langchain/core/tools';
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
import { createVerifyProjectTool } from './verifyProjectTool';
import { createWorkspaceSearchIndexTools } from './workspaceSearchIndexTool';
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
  /** User-configured shell command to validate the project (e.g. npm test); may be empty. */
  agentVerifyCommand: string;
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

/** Core instructions; tool names for this request are appended dynamically in `buildPrompt`. */
const BASE_CORE = `You are TerminalAI — an autonomous coding and terminal assistant (similar in spirit to Cursor's agent).

## How you work
- Prefer **tools** over guessing: read files, list directories, and re-fetch terminal output when needed.
- Start with a **short plan** (1–3 bullets), then execute with tools and concise explanations.
- When you cite code or paths, use **backticks** and real paths relative to the workspace root.
- For **editing existing files**, prefer **search_replace_workspace_file** when the change is localized; use **write_workspace_file** for new files or full rewrites. After a successful patch, **read_workspace_file** (full file or a line slice) on the same path to **verify** the result.
- After **substantive code changes**, suggest running the project’s tests or lint. If **run_project_verify_command** is available (user configured a verify command in settings), call it after meaningful edits when appropriate — never claim tests passed without that tool’s output. Otherwise use **run_workspace_command** when enabled, or suggest the user run \`npm test\`, \`npm run lint\`, \`pytest\`, etc., based on what exists in the repo (check \`package.json\`, \`pyproject.toml\`, \`Cargo.toml\`, Makefile).
- Call **get_terminal_snapshot** again when terminal output may have changed (e.g. after suggesting the user run a command) or when the initial snapshot is likely stale.
- For shell commands the user runs locally: put **each runnable command** in its own fenced \`\`\`bash block. Never claim you ran a command unless **run_workspace_command** or **run_project_verify_command** returned output.
- Warn before **destructive** commands (rm -rf, DROP, mkfs, piping curl to shell, etc.).
- **Vague UI words** (navbar, menu bar, top bar, chrome, shell UI): the codebase rarely uses those exact strings. Map them to likely implementation terms and search **multiple** ways before giving up: \`<header>\`, \`Header\`, \`Nav\`, \`Navigation\`, \`AppBar\`, \`Toolbar\`, \`TopNav\`, \`TabBar\`, layout/route wrappers. Prefer **list_workspace** on \`src\` / \`src/components\`, **grep_workspace_content** for \`header\` / \`navigation\` in \`*.tsx\` / \`*.vue\`, or **search_workspace_index** with concepts like “header navigation menu”. If **find_workspace_files** with \`name_contains\` returns nothing, widen or drop the name filter — filenames often omit the user’s word.

## Tool routing
- Broad “where is X discussed?” across the repo → **search_workspace_index** first; if results are empty or stale → **rebuild_workspace_search_index**, then search again.
- Exact strings, stack traces, or error snippets in files → **grep_workspace_content**; pair with **find_workspace_files** when you need path discovery before searching contents.
- Identifier-like symbols (not full AST) → **find_workspace_symbol** / **find_workspace_references** (word-boundary ripgrep); pass **glob** to limit file types.
- Quick structural skim of one file → **get_workspace_file_outline** before reading large regions.
- Small allowlisted documentation pages → **fetch_url**; long manuals or huge HTML → **read_documentation** with **chunk_index** (0, 1, …).
- npm package discovery → **search_npm_packages**; PyPI metadata for an **exact** distribution name → **lookup_pypi_project**.
- Check path existence/size → **workspace_path_stat** before expensive reads or writes.
- Integrated terminal / subprocess commands → **run_workspace_command** when enabled; user’s saved verify script → **run_project_verify_command** when that tool exists for this session.
- Fresh terminal or attached error text → **get_terminal_snapshot** whenever output may have changed.

Stay factual. If something is not in the workspace or terminal, say so and suggest what to run or open next.`;

function buildPrompt(ctx: AgentRuntimeContext, toolNames: string[]): string {
  const sorted = [...new Set(toolNames.map((n) => n.trim()).filter(Boolean))].sort();
  const toolLine =
    sorted.length > 0
      ? `## Tools available in this session\nOnly call tools whose names appear in this list (server may omit tools when read-only, shell disabled, or similar): ${sorted.join(', ')}.`
      : '## Tools available in this session\nNo tools are registered for this request.';

  const parts = [
    BASE_CORE,
    toolLine,
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
  const verifyCmd = ctx.agentVerifyCommand.trim();
  if (verifyCmd) {
    parts.push(
      `## Project verify command (user preference)\nThe user configured **run_project_verify_command** to run exactly: \`${verifyCmd.replace(/`/g, "'")}\` in the workspace root. Use that tool after substantive edits when validation is appropriate.`
    );
  }
  if (agentReadOnlyMode()) {
    parts.push(
      '## Read-only mode\nServer **AGENT_READ_ONLY** is set: **write_workspace_file**, **search_replace_workspace_file**, **delete_workspace_file**, **copy_workspace_file**, **move_workspace_file**, **run_workspace_command**, and **run_project_verify_command** are **not available**. Use reads, grep, outline, **search_workspace_index** / **rebuild_workspace_search_index**, terminal snapshot, **fetch_url**, **read_documentation**, and **web_search** only; explain changes for the user to apply manually.'
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

/** All LangChain tools for the TerminalAI agent (single source for names + registration). */
export function buildTerminalAgentTools(ctx: AgentRuntimeContext): StructuredToolInterface[] {
  return [
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
    ...createVerifyProjectTool(ctx.workspaceRootAbs, {
      agentVerifyCommand: ctx.agentVerifyCommand,
      terminalSessionId: ctx.terminalSessionId,
      userAlwaysConfirmMutations: !ctx.agentAutoMode,
    }),
    ...createWorkspaceSearchIndexTools(ctx.workspaceRootAbs),
    ...createRegistrySearchTools(),
    ...createFetchUrlTool(),
    ...createReadDocsTool(),
    ...createWebSearchTools(),
  ];
}

/** @internal Self-check for tests: core prompt must retain the routing section. */
export function agentCorePromptIncludesToolRouting(): boolean {
  return BASE_CORE.includes('## Tool routing');
}

export function createTerminalAgentGraph(llm: BaseChatModel, ctx: AgentRuntimeContext) {
  const tools = buildTerminalAgentTools(ctx);
  const toolNames = tools.map((t) => String(t.name));
  return createReactAgent({
    llm,
    tools,
    prompt: buildPrompt(ctx, toolNames),
    version: 'v2',
  });
}
