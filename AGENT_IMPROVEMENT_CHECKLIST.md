# 🤖 AI Coding Agent — Improvement Checklist

> Track progress on making the agent production-grade and Cursor/Claude-equivalent.
> Work through this file in Cursor. Check off items as you implement them.

### Status (TerminalAI repo)

This checklist mixes **aspirational** features with **shipping** work. Items marked `[x]` below mean *implemented or adequately covered in this codebase today* (often under different names). For tool names, see `server/agent/graph.ts` and `server/agent/workspaceTools.ts`. Recent additions: **numbered terminal tabs** (`Terminal 1`…) + **layout menu** “New tab: Dev server / Tests / Agent …”; **`workspaceDirtyPaths`** on **Cline** agent POST when tools are enabled (not plain proxy); **terminal Bot icon** for agent shell; **unsaved-editor** tool + HITL guard; **⌘/Ctrl+K** Monaco → agent; **`color_scheme`** / **`code_font_size_px`**.

### Alignment with `PRD.md`

`PRD.md` (v1) centers **terminal + chat + multi-provider LLM + runnable commands** (e.g. `CommandButton` / `pasteAndRun`). It does **not** require MCP, vector indexing, the Cline VS Code extension diff engine, or automated lint/test gates. **This checklist is a broader roadmap:** several phases are intentionally **partial or empty** in the repo until those features are built. **No phase below is “100% complete”** in the aspirational sense; use the [phase roll-up](#phase-roll-up-prd-style) for a blunt shipped-vs-not summary.

**Bidirectional maintenance:** Each phase below ends with a **PRD** line pointing at [`PRD.md` §11](PRD.md#prd-agent-roadmap). When you change implementation status, update **both** the checkboxes here and the matching **§11.n** paragraph in the PRD (and the §11 summary table if row counts shift).

### v1 product scope vs this checklist

**Release criteria for TerminalAI v1 are [`PRD.md`](PRD.md) §4 (features) and §10 (success criteria)** — terminal + chat + multi-provider models + runnable commands, etc. [`PRD.md` §9](PRD.md#9-out-of-scope-v1) states that **full completion of this checklist is explicitly out of scope for v1.** Unchecked `[ ]` rows below are **roadmap** items (MCP runtime, vector index, Cline-extension-style apply/undo, automated quality gates, …), not a single milestone. Agent panel layout: **450px** at viewport **≥900px**, slide-over below that ([`MainLayout.tsx`](src/components/Layout/MainLayout.tsx)). For shipped-by-phase status, use the [phase roll-up](#phase-roll-up-prd-style) table.

---

## 🗂️ Table of Contents

- [Phase 1 — Tool Use Foundation](#phase-1--tool-use-foundation)
- [Phase 2 — LangGraph Orchestration](#phase-2--langgraph-orchestration)
- [Phase 3 — Monaco Editor Integration](#phase-3--monaco-editor-integration)
- [Phase 4 — Terminal Integration](#phase-4--terminal-integration)
- [Phase 5 — Cline Agentic Editing](#phase-5--cline-agentic-editing)
- [Phase 6 — MCP Tool Integrations](#phase-6--mcp-tool-integrations)
- [Phase 7 — Context & Memory](#phase-7--context--memory)
- [Phase 8 — Planning & Reasoning](#phase-8--planning--reasoning)
- [Phase 9 — Code Quality & Safety](#phase-9--code-quality--safety)
- [Phase 10 — UX & Developer Experience](#phase-10--ux--developer-experience)
- [Phase 11 — Performance & Reliability](#phase-11--performance--reliability)
- [Phase 12 — Security & Sandboxing](#phase-12--security--sandboxing)
- [Phase roll-up (PRD-style)](#phase-roll-up-prd-style)

---

## Phase roll-up (PRD-style)

| Phase | Shipped in repo? | Notes |
|-------|------------------|--------|
| **1** — Tools | **Partial** | Read/write/list/grep/stat + delete/copy/move; npm/PyPI; fetch_url; **read_documentation** (chunked allowlisted fetch); web_search; **find_workspace_symbol** / **find_workspace_references** (word-boundary rg); **get_workspace_file_outline** (regex/heuristic, not LSP/AST); no recursive dir delete in-tool. |
| **2** — LangGraph | **Partial** | `createReactAgent` + streaming + HITL; **AGENT_READ_ONLY** omits mutating file + shell tools; no custom planner/checkpoint/subgraphs. |
| **3** — Monaco | **Partial** | Tabs, explorer, theme, minimap/folding/**sticky scroll**, **path breadcrumbs**; chat `` `path:line` `` → **reveal line**; ⌘/Ctrl+L prepends active file; **⌘/Ctrl+K** opens agent with **selection → fenced block** (chat panel, not inline ghost text); no inline diff review. |
| **4** — Terminal | **Strong** | xterm, PTY, splits, agent shell, paste-and-run; **Bot** tab hint; **numbered + preset-named** tabs (`Terminal N`, layout menu presets, double-click rename). |
| **5** — Cline *extension-style* editing | **Not implemented** | Cline is an **optional chat backend** (`/api/agent/cline`); file ops are **not** routed through Cline’s patch/undo UX. **Chat-only:** collapsible **fenced diff** in assistant messages (`ChatDiffFence.tsx`). |
| **6** — MCP | **Minimal** | **`.mcp.json`** read + workspace editor badge (`mcpServers`); no MCP client or agent tools |
| **7** — Context / memory | **Minimal** | SQLite prefs + chat persistence + `workspaceRoot` / `clineLocalBaseUrl` on agent POST; no embeddings or working-set tracker. |
| **8** — Planning | **Minimal** | Step limits + tool repeat guard; optional **AGENT_ENFORCE_READ_BEFORE_WRITE**; **client dirty paths** on **`/api/agent`** and **Cline tools** POST (not plain proxy) + HITL approve; no tree-of-thought / sub-agents. |
| **9** — Quality gates | **Not implemented** | No auto test/lint/semgrep loop in product. |
| **10** — UX | **Partial** | All **checkbox rows** covered (many partial): stream, **interrupted-stream** banner, **⌘/Ctrl+Z** palette copy, tool UI + timing, tokens, diff fences, palette, quick actions, paths → editor. |
| **11** — Performance | **Minimal** | Health, SQLite persistence, **post-refresh interrupted-stream** notice, dev tool logs, agent fetch retry/backoff, **slow-response** footer; no latency SLOs or true stream resume. |
| **12** — Security | **Partial** | Workspace sandbox + HITL + allowlist patterns; **tool/HITL/read-tool secret-pattern redaction**; no Docker sandbox or audit log DB. |

**PRD:** Per-phase narrative and maintenance live in [`PRD.md` §11 — Agent roadmap](PRD.md#prd-agent-roadmap) (subsections **§11.1–§11.12**, anchors `#prd-phase-1` … `#prd-phase-12`). Update §11 when this roll-up or any phase’s checkboxes change.

---

## Phase 1 — Tool Use Foundation

> Goal: Give the agent full file system + shell access on par with Claude Code.

### 📁 File System Tools
- [x] `read_file(path)` — `read_workspace_file` (+ optional line range)
- [x] `write_file(path, content)` — `write_workspace_file` (create/replace modes)
- [x] `edit_file(path, diff)` — `search_replace_workspace_file` (exact substring / replace_all; not unified diff)
- [x] `create_file(path, content)` — `write_workspace_file` with `mode: create`
- [x] `delete_file(path)` — `delete_workspace_file` (files; empty dirs only with `allow_empty_directory`)
- [x] `list_directory(path, recursive?)` — `list_workspace` (non-recursive listing; capped entries)
- [x] `search_files(query, glob?)` — `find_workspace_files` + `grep_workspace_content`
- [x] `move_file(src, dest)` — `move_workspace_file` (regular files only)
- [x] `copy_file(src, dest)` — `copy_workspace_file` (regular files only)
- [x] `file_exists(path)` — `workspace_path_stat` (exists, file/dir, size, mtime)

### 🔍 Code Search Tools
- [x] `find_symbol(name)` — Use `grep_workspace_content`; no AST/LSP — **Partial:** tool **find_workspace_symbol** (`symbolWorkspaceTools.ts`) — ripgrep **\\b** word-boundary regex (not unicode-aware LSP). Shared engine via **runWorkspaceContentGrep** (`workspaceGrepTool.ts`)
- [x] `find_references(symbol)` — Same as above — **Partial:** tool **find_workspace_references** — same pattern, default **max_line_hits** 160 vs 120 for symbol; still text-only
- [x] `grep_codebase(pattern)` — `grep_workspace_content`
- [x] `get_file_outline(path)` — **Partial:** tool **get_workspace_file_outline** (`server/agent/outlineWorkspaceTool.ts`) — line-based regex for TS/JS (incl. Vue/Svelte), Python, Go, Rust, Markdown; capped entries; same sandbox + size cap as file reads; not AST/LSP

### 🌐 Web & External Tools
- [x] `web_search(query)` — Real-time search (Brave / Serper / Tavily) — **Partial:** tool **web_search** (`webSearchTool.ts`) calls DuckDuckGo **instant answer** JSON API (abstract, answer, definition, related topics — not a full SERP). No API key. **AGENT_DISABLE_WEB_SEARCH** to block outbound calls. No Brave/Serper/Tavily integration yet
- [x] `fetch_url(url)` — Retrieve and parse any web page — **Partial:** tool **fetch_url** (`fetchUrlTool.ts`): **HTTPS only**, **hostname allowlist** (MDN, Node, Python docs, TS, PyPI, npm, GitHub, cppreference, RFC sources, `*.readthedocs.io`, `*.github.io`) + **AGENT_FETCH_URL_ALLOWLIST**; blocks private/local hosts; **manual redirects** with per-hop allowlist; text/html → stripped text, JSON pretty-print, size/time limits (**AGENT_FETCH_URL_MAX_BYTES**, **AGENT_FETCH_URL_TIMEOUT_MS**). Disable: **AGENT_DISABLE_FETCH_URL**. Not an arbitrary open-web fetch
- [x] `search_npm(package)` — Look up npm package info and latest version — **Partial:** tool **search_npm_packages** (`registrySearchTools.ts`) queries `registry.npmjs.org` search API; returns top matches with version + description. Optional **AGENT_DISABLE_PACKAGE_REGISTRY_TOOLS**
- [x] `search_pypi(package)` — Look up PyPI package — **Partial:** tool **lookup_pypi_project** fetches `pypi.org/pypi/{name}/json` (**exact** name only, not fuzzy search). Same env disable as npm
- [x] `read_docs(url_or_name)` — **Partial:** tool **read_documentation** (`server/agent/readDocsTool.ts`) — same **https allowlist** as **fetch_url**; returns **one text chunk** per call (**chunk_index** 0…n−1); **AGENT_READ_DOCS_CHUNK_CHARS** / **AGENT_DISABLE_READ_DOCS**; no fuzzy “name → URL” resolver (pass a full allowlisted URL)

**PRD:** [`PRD.md` §11.1](PRD.md#prd-phase-1) — Phase 1 implementation status *(keep in sync).*

---

## Phase 2 — LangGraph Orchestration

> Goal: Replace single-shot completions with a stateful, multi-step agent loop.

### 🧠 Core Graph Nodes
- [x] `planner` node — Implicit in ReAct (`createReactAgent`); no separate planner node
- [x] `tool_caller` node — LangGraph prebuilt agent loop
- [x] `tool_executor` node — LangChain tools + stream events
- [ ] `observer` node — No dedicated observer; model decides next step
- [x] `responder` node — Chat model stream in `runAgent.ts`
- [ ] `error_handler` node — Tool errors surface in stream; no auto-retry node

### 📦 State Schema
- [x] `messages` — Conversation passed into graph each request
- [ ] `task_plan` — Not persisted as structured plan
- [ ] `file_context` — Not a central map; model re-reads via tools
- [x] `terminal_history` — `get_terminal_snapshot` + initial context in prompt
- [ ] `tool_results` — Ephemeral per turn in LangGraph state only
- [ ] `error_log` — Not structured across steps
- [x] `user_preferences` — Partial: SQLite prefs + settings (provider, agent backend, workspace root)

### 🔁 Execution Modes
- [x] **Auto mode** — Default (tools run without per-step user confirm, except HITL when configured)
- [x] **Supervised mode** — `AGENT_REQUIRE_APPROVAL_FOR_WRITES` / `AGENT_REQUIRE_APPROVAL_FOR_SHELL`
- [ ] **Step-by-step mode** — Every tool gated (not supported)
- [x] **Read-only mode** — Server **AGENT_READ_ONLY** (`approvalEnv.ts`): **write** / **search_replace** / **delete** / **copy** / **move** workspace tools and **run_workspace_command** are omitted from the graph; system prompt notes read-only (`graph.ts`). Reads, grep, fetch, web_search, registry tools remain.

### 🔀 Advanced Graph Features
- [x] Conditional branching — Model-driven (ReAct)
- [ ] Parallel node execution — Sequential tool calls
- [ ] Checkpoint + resume — Not exposed
- [ ] Sub-graph delegation — Not implemented
- [x] Human-in-the-loop interrupt — HITL approve/reject + `pendingApprovalsStore`

**PRD:** [`PRD.md` §11.2](PRD.md#prd-phase-2) — Phase 2 *(keep in sync).*

---

## Phase 3 — Monaco Editor Integration

> Goal: Make Monaco feel like Cursor — AI-aware, diff-friendly, context-rich.

### ✏️ Core Editor
- [x] Multi-file tabbed editing with unsaved-changes indicator — `WorkspaceEditorPanel`
- [ ] Split pane support (horizontal + vertical) — Editor/terminal split only
- [x] File explorer sidebar synced with workspace file system
- [x] Syntax highlighting for all major languages (Monaco built-in)
- [x] Theme support: dark / light / high-contrast — Custom `terminalai-vscode` theme in Monaco

### 🤖 AI Integration
- [ ] Inline ghost-text completions (Copilot-style Tab-to-accept)
- [x] **Cmd+K** — Trigger agent on selected code or current file — **Partial:** ⌘/Ctrl+K in **workspace Monaco** (`WorkspaceEditorPanel` `onMount` keybinding) opens the agent panel, focuses chat, and sets input to **active file** + **fenced selection** when the selection is non-empty (truncated at 32k chars); empty selection → file + “What would you like to do…”. **⌘/Ctrl+Shift+K** opens the shortcuts palette from the editor (`useKeyboardShortcutsPalette`). Not Copilot-style **inline** completion UI
- [x] **Cmd+L** — Open chat sidebar with current file as context — **Shipped:** ⌘/Ctrl+L opens agent panel, focuses chat, prepends `Workspace editor (active file): \`path\`` to the input when a workspace tab is open (`activeWorkspaceEditorPath` in `workbenchStore`, `injectWorkspaceEditorFileContext` in `chatStore`, `useWorkbenchHotkeys`). No automatic file body injection; agent can `read_workspace_file`
- [ ] Inline diff view — Show agent-proposed changes before applying
- [ ] Accept / reject individual hunks in the diff view
- [x] Agent decorations — Highlight lines the agent is referencing — **Partial:** assistant inline `` `path:line` `` / `` `path#L42` `` / `` `path#42` `` (`parseWorkspacePathWithLine`) open the workspace editor and **reveal** that line (`workbenchStore.openEditorFileLine`, `WorkspaceEditorPanel`); **not** gutter glyph decorations or a live “agent cursor” overlay

### 🔧 Language Intelligence (LSP)
- [ ] Go-to-definition (F12)
- [ ] Find all references (Shift+F12)
- [ ] Hover documentation
- [ ] IntelliSense / auto-complete
- [ ] Inline error / warning squiggles
- [x] Breadcrumb navigation — **Partial:** workspace-relative **file path** crumbs above the editor (`BreadcrumbPath` in `WorkspaceEditorPanel`); parent segments are **buttons** that set the quick-open field (Enter / Open) — **not** LSP symbol / outline breadcrumbs
- [x] Minimap — enabled in `WorkspaceEditorPanel` Monaco options (not LSP-driven)

> Monaco in `WorkspaceEditorPanel` also enables **bracket guides**, **basic `quickSuggestions`**, and **parameter hints** for supported languages — still **not** a project-attached LSP server for go-to-definition across the repo.

### 📝 Editor Convenience
- [ ] Persistent undo/redo history (survives agent edits)
- [x] Format on save (Prettier / Black / rustfmt via tool call) — **Partial:** optional **Format on manual save** in **API keys** → Workspace editor (`workspace_format_on_save` in SQLite); **Ctrl/Cmd+S** and the Save button run Monaco **`editor.action.formatDocument`** when supported, then **PUT** the buffer (`WorkspaceEditorPanel.tsx`); **not** Prettier/Black/rustfmt CLI; **30s auto-save** does not format
- [x] Multi-cursor editing — Monaco default (e.g. Alt+click); not surfaced as a dedicated product tutorial
- [x] Sticky scroll (keeps current scope visible while scrolling) — **Shipped:** `stickyScroll: { enabled: true, defaultModel: 'indentationModel', maxLineCount: 5 }` in `WorkspaceEditorPanel.tsx` (Monaco built-in; not LSP scope headers)
- [x] Code folding — `folding: true` in `WorkspaceEditorPanel`

**PRD:** [`PRD.md` §11.3](PRD.md#prd-phase-3) — Phase 3 *(keep in sync).*

---

## Phase 4 — Terminal Integration

> Goal: Full shell access the agent and user can both interact with.

### 🖥️ Core Terminal
- [x] xterm.js embedded terminal with full ANSI/color support
- [x] Persistent bash/zsh session across agent tool calls — PTY per tab
- [x] Working directory indicator in shell prompt — User shell config + OSC cwd sync
- [x] Command history navigation (arrow keys) — Shell handles
- [x] Terminal resize handling (cols × rows update on window resize)

### 🤖 Agent-Controlled Terminal
- [x] Agent can send commands programmatically to the shell — `run_workspace_command` when `AGENT_ALLOW_SHELL=1`
- [x] Real-time stdout/stderr streaming shown in terminal pane
- [x] Agent captures command exit code + full output — Via tool + `get_terminal_snapshot`
- [x] User can type into terminal at any time (no lockout during agent use)
- [x] Visual indicator when agent is actively using the terminal — **Partial:** **`Bot`** icon + tooltip on the terminal tab whose id matches the in-flight agent stream’s **`terminalSessionId`** while **`run_workspace_command`** is **running** or **awaiting_approval** (`chatStore.agentStreamShellSessionId`, `TerminalTabBar`). Subprocess-only shell (no linked PTY) has no tab badge; **Cline** backend unchanged

### 🗂️ Terminal Management
- [x] Multiple terminal tabs (each with own shell session)
- [x] Split terminal panes — Horizontal/vertical layouts in UI
- [x] Named terminals (e.g., "Dev Server", "Tests", "Agent") — **Partial:** default **`Terminal 1`**, **`Terminal 2`**, … for new/split tabs (`nextNumberedTerminalTabTitle`); **Terminal** layout menu → **New tab: Dev server | Tests | Agent | Build | Logs** (`TERMINAL_TAB_NAME_PRESETS`); double-click tab rename; first command still overwrites title via `tabTitleFromCommandLine`. Not persisted role-based presets across reloads beyond SQLite terminal state
- [x] Kill process button per terminal tab — **Partial:** toolbar **Send Ctrl+C** (interrupt foreground job) for the **focused** terminal (`TerminalPanel` + `interruptFocusedTerminal` / `sendInterrupt` on `TerminalController`); does not destroy the PTY or tab
- [x] Clear terminal button — **Clear display** (eraser icon) clears the xterm viewport for the **focused** session (`clearFocusedTerminal` → `Terminal.clear()`)

**PRD:** [`PRD.md` §11.4](PRD.md#prd-phase-4) — Phase 4 *(keep in sync).*

---

## Phase 5 — Cline Agentic Editing

> Goal: Use Cline for all file mutations so edits are safe, diffable, and reversible.

### ✅ What exists today (vs extension-style goals below)

- [x] **Cline as alternate chat backend** — UI + `clineAgent.ts` can stream via a local OpenAI-compatible Cline bridge; **workspace file mutations stay LangGraph tools**, not Cline’s patch/apply pipeline.

### ✅ Core Cline Features
- [ ] All file writes routed through Cline (not raw fs.writeFile)
- [ ] Diff preview shown in Monaco before Cline applies changes
- [ ] Rollback: snapshot file state before every Cline write
- [ ] One-click undo of all Cline edits in a session
- [ ] Cline edit history panel (per-file change log)

### 🔁 Cline + LangGraph Loop
- [ ] Cline tool registered as a LangGraph tool node
- [ ] Agent calls Cline for: create, edit, delete, move operations
- [ ] Agent uses read_file (not Cline) for non-mutating reads
- [ ] Cline results fed back into LangGraph observer node

### 📋 Diff & Apply UX
- [x] Unified diff shown in chat (collapsible) — **Partial:** assistant fenced **`diff`** / **`patch`** blocks are **collapsible** (chevron hides inline preview; **Copy** / **View full** stay in header) + full dialog (`ChatDiffFence.tsx`). **Not** Cline patch pipeline or apply/reject
- [ ] Full inline diff shown in Monaco split view
- [ ] "Apply All" and "Reject All" buttons
- [ ] Per-hunk accept/reject controls
- [ ] Auto-apply after timeout if user is in Auto mode

**PRD:** [`PRD.md` §11.5](PRD.md#prd-phase-5) — Phase 5 *(keep in sync).*

---

## Phase 6 — MCP Tool Integrations

> Goal: Extend the agent's reach with real-world external tool integrations.

### 🔌 MCP Framework
- [x] MCP server configuration file (`.mcp.json` in project root) — **Partial:** Cursor-style JSON with top-level **`mcpServers`** is **read** from the workspace root; workspace editor shows an **MCP · N servers** badge + tooltip (and invalid-file warning). See **`.mcp.json.example`**. **No** MCP client, tool discovery, or LangGraph wiring yet
- [ ] Dynamic MCP server registration at runtime
- [ ] MCP tool discovery — agent learns available tools from server manifest
- [ ] MCP tool calls proxied through LangGraph tool_executor node
- [ ] Error handling for MCP connection failures

### 🛠️ Built-in MCP Servers
- [ ] **GitHub MCP** — Issues, PRs, commits, repo search
- [ ] **Web Search MCP** — Brave/Serper search integration
- [ ] **Database MCP** — SQL query + schema inspection (PostgreSQL/SQLite)
- [ ] **Filesystem MCP** — Extended file operations
- [ ] **Slack MCP** — Read channels, post messages
- [ ] **Linear MCP** — Issues, projects, cycles

### 🧩 Custom MCP Support
- [ ] Users can add any MCP-compliant server via config
- [ ] UI to browse, enable, and disable connected MCP servers
- [ ] Tool usage log showing which MCP tools were called and why

**PRD:** [`PRD.md` §11.6](PRD.md#prd-phase-6) — Phase 6 *(keep in sync).*

---

## Phase 7 — Context & Memory

> Goal: The agent should know your entire codebase, not just the open file.

### 📚 Codebase Indexing
- [ ] On session start, index all project files into vector embeddings
- [ ] Incremental re-index on file save (only changed files)
- [ ] Semantic search over codebase: "find where auth tokens are validated"
- [x] Exclude patterns (`.gitignore`, `node_modules`, `dist`, etc.) — **Partial:** `grep_workspace_content` applies fixed excludes (`.git`, `node_modules`, `dist`, `build`, `.next`, `coverage`, secret-style `.env*` basenames); ripgrep also respects `.gitignore` by default. No vector index / embedding pipeline
- [ ] Index metadata: file path, language, last modified, symbol list

### 🧠 Persistent Memory
- [x] Store user preferences across sessions (language, formatting style) — **Partial:** SQLite app prefs + provider/model/workspace/agent backend (`persistence` API + `putPrefs`); not arbitrary free-form “user rules” memory
- [ ] Remember project conventions (naming patterns, folder structure)
- [ ] Session summary — auto-summarize what was done for next session
- [ ] Explicit memory: "Remember that we use Zod for all API validation"

### 📂 Working Set Management
- [x] Track which files the agent recently read/edited — **Partial:** live tool rows in chat (`AgentToolActivity`) show current-turn file paths; **no** persisted cross-session working-set index
- [ ] Auto-include most relevant files in context window
- [x] "Pin file" — always include a specific file in agent context — **Shipped:** `agent_pinned_paths_json` on `app_prefs`, prompt append via `buildPinnedFilesPromptAppend` (`server/agent/pinnedFilesPrompt.ts`); UI: workspace editor **Pin** / **Unpin** (`WorkspaceEditorPanel.tsx`) and list/remove under **API keys → Agent behavior** (`ApiKeyModal.tsx`). Budget-limited snapshots; not full-file guarantee for huge files
- [ ] Import graph awareness — include imported modules when editing a file

**PRD:** [`PRD.md` §11.7](PRD.md#prd-phase-7) — Phase 7 *(keep in sync).*

---

## Phase 8 — Planning & Reasoning

> Goal: Smarter planning so the agent handles complex, multi-step tasks reliably.

### 🌲 Advanced Planning
- [ ] **Tree-of-thought** — Explore multiple solution approaches before committing
- [ ] **Self-critique loop** — After writing code, agent reviews its own output
- [ ] **Test-driven mode** — Write failing tests first, then implement to pass
- [ ] **Confidence scoring** — Agent rates its own certainty; asks for clarification when low
- [ ] **Plan preview** — Show user the proposed steps before executing

### 🔄 Multi-Agent Patterns
- [ ] Sub-agent for test writing (separate from code-writing agent)
- [ ] Sub-agent for documentation generation
- [ ] Sub-agent for code review (reads PR diff, leaves comments)
- [ ] Orchestrator + worker pattern for parallel file edits

### 🛑 Guardrails
- [x] Agent must read a file before it can write to it — **Partial:** server **AGENT_ENFORCE_READ_BEFORE_WRITE** (`workspaceReadBeforeWrite.ts`, `workspaceTools.ts`, `outlineWorkspaceTool.ts`, `runAgent.ts` / `graph.ts`); tracks **read_workspace_file** + **get_workspace_file_outline** per request; **write_workspace_file** **create** and replace-when-missing exempt; **grep** alone does not count
- [x] Agent cannot overwrite a file that has unsaved user edits — **Partial:** **`dirtyWorkspacePaths`** synced from workspace editor tabs (`workbenchStore` + `WorkspaceEditorPanel`); sent on **`/api/agent`** and **`/api/agent/cline`** when the Cline route uses **LangGraph tools** (not **`CLINE_AGENT_DISABLE_TOOLS=1`** plain proxy); **`workspaceClientDirtyPaths`** + **`createWorkspaceTools`** refuse write/patch/delete/copy/move on dirty keys; **`/api/agent/hitl/approve`** passes the same list into **`executeApproved`**. **Gaps:** no merge/three-way UI; plain Cline proxy ignores dirty paths; list is trust-on-client
- [x] Max tool calls per task configurable — `AGENT_MAX_STEPS` / `AGENT_RECURSION_LIMIT`
- [x] Infinite loop detection — `AGENT_TOOL_REPEAT_GUARD` (≥2 identical consecutive tool starts aborts stream)

**PRD:** [`PRD.md` §11.8](PRD.md#prd-phase-8) — Phase 8 *(keep in sync).*

---

## Phase 9 — Code Quality & Safety

> Goal: Every agent-generated code change should be correct, safe, and tested.

### 🧪 Testing
- [ ] After code changes, agent auto-runs the relevant test suite
- [ ] Test output streamed to terminal and summarized in chat
- [ ] If tests fail, agent enters a fix loop (up to 3 attempts)
- [ ] Coverage report shown after test run
- [x] "Write tests for this" quick action button — **Partial:** ⌘/Ctrl+K → **Write tests for this** opens the agent panel, prefills chat (`WRITE_TESTS_CHAT_PREFILL`), prepends active workspace file when a tab is open (`buildAgentQuickActionInput`), focuses the input; user edits and sends. Not a one-click agent run

### 🔍 Static Analysis
- [ ] Run linter (ESLint / Ruff / Clippy) before applying any file change
- [ ] Run type checker (tsc / mypy / pyright) on affected files
- [ ] Block apply if critical errors are introduced by the agent's change
- [ ] Show diff of new errors introduced (not just total error count)

### 🔒 Security Scanning
- [ ] Run Semgrep rules on agent-written code
- [ ] Flag hardcoded secrets, SQL injection, XSS patterns
- [ ] Show security warning inline in Monaco with explanation
- [ ] Security scan runs async — doesn't block code apply

### ⏪ Rollback & Recovery
- [ ] Full snapshot of workspace before each agent task run
- [ ] "Undo last agent session" button — restores all files to pre-task state
- [ ] Per-file rollback via file history panel
- [ ] Dry-run mode: show all planned changes as a diff without applying

**PRD:** [`PRD.md` §11.9](PRD.md#prd-phase-9) — Phase 9 *(keep in sync).*

---

## Phase 10 — UX & Developer Experience

> Goal: The experience should feel fluid, fast, and delightful to use.

### 💬 Chat Interface
- [x] Streaming responses with token-by-token display
- [x] Code blocks with syntax highlighting and copy button
- [x] Inline file references — click to open file in Monaco — **Partial:** assistant **inline** `` `path` `` spans matching `isLikelyWorkspaceRelativePath` render as buttons → `requestOpenEditorFile` → workspace editor opens + loads file (`workbenchStore`, `workspacePathHeuristic.ts`); fenced blocks unchanged
- [x] Inline diff blocks — click to open full diff view — **Partial:** assistant fenced **`diff`** / **`patch`** blocks render with **+/-** / **@@** tinting, **Copy**, **Expand** / **View full** (dialog), **chevron** to collapse/expand inline preview; click preview opens dialog (`ChatDiffFence.tsx`, `ChatMessage.tsx`). Not Monaco apply/apply-hunk preview
- [x] Message actions: copy, regenerate, rewrite (thumbs up/down not present)
- [x] Clear chat / new session button

### ⌨️ Keyboard Shortcuts
- [x] `Cmd+K` — Open agent with selected code *(workspace Monaco: `openAgentWithWorkspaceEditorSelection` in `chatStore`; elsewhere ⌘/Ctrl+K opens the **command palette** — **⌘/Ctrl+Shift+K** and **⌘/Ctrl+Shift+P** always open it)*
- [x] `Cmd+L` — Open chat sidebar — **Partial:** same as Phase 3 **Cmd+L** row: panel + focus + active-file line in input (`useWorkbenchHotkeys`, `injectWorkspaceEditorFileContext`)
- [x] `Cmd+Shift+P` — Command palette (natural language action search) — **Partial:** same dialog as **⌘/Ctrl+Shift+K** (`useKeyboardShortcutsPalette.tsx`); renamed **Command palette** with **text filter** for shortcuts, quick actions, and terminal commands (`KeyboardShortcutsDialog.tsx`); **not** NL intent routing or VS Code–style extension commands
- [x] `Cmd+Z` / `Cmd+Shift+Z` — Undo/redo (editor + agent edits unified) — **Partial:** **workspace Monaco** uses the built-in **undo/redo** stack (**⌘/Ctrl+Z**, **⌘/Ctrl+Shift+Z**); **chat input** uses the browser’s native undo in the textarea. **No** single “undo last agent tool write” across the repo or a merged agent + editor history; reloading a file from disk after a tool write **replaces** the buffer and resets the stack
- [x] `Cmd+\`` — Toggle terminal panel — **Partial:** ⌘/Ctrl+\` collapses/expands bottom split when editor+terminal layout (`MainLayout` + `react-resizable-panels`)
- [x] `Cmd+B` — Toggle file explorer sidebar — ⌘/Ctrl+B toggles workspace file tree (`useWorkbenchStore` + `WorkspaceEditorPanel`)

### 📊 Agent Transparency
- [x] Live task progress panel showing current LangGraph node — **Partial:** stream events **`graph_phase`** (`model` | `tool` + optional **`langgraph_node`**) from `runAgent.ts` → `streamProtocol.ts`; client **`agentGraphPhase`** in `chatStore` + badge beside **Responding…** and tooltips via `describeAgentLiveActivity` (`agentActivitySummary.ts`, `ChatSidebar.tsx`). **Not** a docked graph inspector or full node timeline; **Cline** backend does not emit these events
- [x] Step log: every tool call with input, output, and timing — **Partial:** collapsible **Tools** rows (`AgentToolActivity`) show **title/subtitle** (input summary), **preview/error** (output), and **elapsedMs** from server on **`tool_done`** (`runAgent.ts` → `streamProtocol`); not a separate docked log panel or full raw JSON
- [x] Token usage counter per session — **Partial:** server emits **`usage`** (`inputDelta` / `outputDelta`) from LangChain **`usage_metadata`** on each **`on_chat_model_end`** for the agent node (`runAgent.ts`); client accumulates in **`sessionTokenUsage`**, shows **Tokens: N in · M out** under the model row (`ChatSidebar`); resets on New chat, Clear chat, or deleting the active conversation. **No** counts for **Cline** backend or models that omit usage metadata
- [x] "What is the agent doing?" explanation on hover — **Partial:** native **`title`** + help (**CircleHelp**) tooltip on the **Generating** row in `ChatSidebar.tsx`; text from `describeAgentLiveActivity` in `src/lib/agentActivitySummary.ts` (awaiting HITL, pending approvals count, running tool labels, else generic streaming); not a LangGraph node / live graph panel
- [x] Collapsible tool call results in chat — `AgentToolActivity` + `TERMINALAI_EVENT:` stream

### 🚀 Quick Actions Panel
- [x] Run Tests — **Partial:** ⌘/Ctrl+K → **Run tests** (`npm test`) via `pasteAndRun` on the focused terminal tab; not a dedicated docked panel or agent auto-loop
- [x] Format All Files — **Partial:** same palette → **Format (Prettier)** (`npm run format`)
- [x] Build Project — **Partial:** same palette → **Build project** (`npm run build`)
- [x] Git Status — **Partial:** same palette → **Git status**; also **Typecheck** / **Lint** buttons in the same section
- [x] Commit & Push — **Partial:** ⌘/Ctrl+K → **Commit & push (WIP message)** runs `git add -A && git commit -m "chore: wip (TerminalAI)" && git push` via `pasteAndRun`; user should **amend** the message if needed; same terminal focus rules as other palette commands
- [x] Explain Selected Code — **Partial:** ⌘/Ctrl+K → **Explain code / file** (`EXPLAIN_SELECTED_CODE_CHAT_PREFILL`); same active-file prefix as other agent quick actions; user may paste a selection into the input
- [x] Generate Docs for File — **Partial:** ⌘/Ctrl+K → **Generate docs for file** (`GENERATE_DOCS_FILE_CHAT_PREFILL`)
- [x] Find Bugs in File — **Partial:** ⌘/Ctrl+K → **Find bugs in file** (`FIND_BUGS_FILE_CHAT_PREFILL`)

### 🎨 Personalization
- [x] Theme: dark / light / system — **Partial:** SQLite `color_scheme` + **Appearance** in **API keys** dialog; `data-terminalai-theme` on `<html>`; Tailwind `terminalai.*` via CSS variables; Monaco `terminalai-vscode` / `terminalai-vscode-light`; xterm colors follow effective theme; OS `prefers-color-scheme` when **System** is selected (`PersistenceProvider` listener). Electron/web only where the web UI runs
- [x] Font size + font family for editor and terminal — **Partial:** shared **code font size** (10–22px) persisted as `code_font_size_px`; applies to **workspace Monaco** and **xterm**; chat UI body font unchanged; **no** custom font-family picker (JetBrains Mono / Cascadia stack remain)
- [x] Agent verbosity: concise / detailed / step-by-step — SQLite `agent_verbosity` + **Agent behavior** in **API keys**; appended to system prompt (`server/lib/agentStylePrefs.ts`, `server/agent/graph.ts`)
- [x] Auto mode toggle (persistent setting) — SQLite `agent_mode` exposed as `agentAutoMode` (`1` = Auto / env-only HITL, `0` = always confirm file & shell mutations); UI under **API keys** → Agent behavior; wired in `workspaceTools` / `shellTool` + `GET /api/agent/hitl/status`
- [x] Preferred language/framework hints for the agent — SQLite `agent_context_hints` (max 4000 chars) + textarea in **API keys** → Agent behavior

**PRD:** [`PRD.md` §11.10](PRD.md#prd-phase-10) — Phase 10 *(keep in sync).*

---

## Phase 11 — Performance & Reliability

> Goal: The agent should be fast, stable, and never lose your work.

### ⚡ Latency Targets
- [ ] First token latency < 300ms
- [ ] Terminal command → first output < 100ms
- [ ] File write → editor update < 50ms
- [ ] Codebase index (10k files) < 10 seconds
- [ ] Monaco keystroke → render < 16ms (60fps)

### 🛡️ Reliability
- [x] Auto-save all open files every 30 seconds — **Partial:** workspace **Monaco** tabs only; every **30s** `setInterval` saves **dirty** buffers via `saveWorkspaceFile` (`WorkspaceEditorPanel.tsx`); failures set the panel error line; no debounce beyond the interval
- [x] Session state persisted — **Partial:** conversations + messages + app prefs in **SQLite** via `/api/persistence` (not IndexedDB); legacy one-time migration may read old `localStorage` keys
- [x] Resume interrupted agent task after page refresh — **Partial:** if the tab was **closed or reloaded** while an agent stream was active, a **banner** explains the reply may be truncated and suggests resend/regenerate (**no** automatic provider stream resumption); `sessionStorage` + `pagehide` (`useAgentStreamInterruptedNotice`, `agentStreamInterruptedNotice.ts`). **Not** a true resume of the upstream SSE stream
- [x] Graceful degradation if LLM API is slow (show partial results) — **Partial:** assistant stream is **token-by-token**; after **4s** with an active stream the chat footer adds a **slow provider / incremental text** note (`ChatSidebar`); no adaptive quality tiers
- [x] Retry with exponential backoff on transient API errors — **Partial:** `fetchAgentStreamWithRetry` on agent POST (`/api/agent`, `/api/agent/cline`): retries up to 4× on **408 / 429 / 502 / 503 / 504** and **network throws**, exponential backoff + jitter, abort-aware (`src/lib/agentStreamFetch.ts`)

### 📈 Observability
- [x] Log all tool calls with timing to browser DevTools console (dev mode) — **Partial:** `withDevAgentStreamTelemetry` wraps the chat stream feed; logs `tool_start`, `tool_done` (**server `elapsedMs` when present**, else client delta), `approval_required` via `console.debug` when `import.meta.env.DEV` only
- [x] Error boundary around each major UI component — **Partial:** `UiErrorBoundary` wraps **Chat**, **Workspace editor**, and **Terminal** in `MainLayout` (+ `/terminal-only`); isolated fallback + **Try again** remounts children; dev-only `console.error` with component stack
- [x] Health check endpoint for backend services — `GET /api/health`
- [ ] Session replay for debugging (opt-in)

**PRD:** [`PRD.md` §11.11](PRD.md#prd-phase-11) — Phase 11 *(keep in sync).*

---

## Phase 12 — Security & Sandboxing

> Goal: The agent should never be able to damage the user's system or leak secrets.

### 🔐 Execution Sandbox
- [ ] All shell commands run inside a sandboxed container (Docker / WebContainer)
- [x] No access to host file system outside the project workspace — Path sandbox + optional `AGENT_WORKSPACE_ALLOWLIST`
- [ ] Network requests from agent-run code go through an allowlist
- [ ] Resource limits: max CPU, memory, and disk usage per session

### 🔑 Secrets Management
- [x] API keys stored as env vars; never passed in plain text to the LLM — Server merges keys from DB; client can send key per request
- [x] `.env` files excluded from codebase indexing and context — **Partial:** common secret env basenames skipped by `grep_workspace_content` only; no embeddings index; `read_workspace_file` / chat context do not auto-strip `.env`
- [x] Secret detection: warn if agent tries to log or return a secret value — **Partial:** `redactLikelySecrets` (`server/lib/agentSecretLeak.ts`) on **tool_done** preview/error in `runAgent.ts`; **read_workspace_file** (full + line slice) and **get_workspace_file_outline** return text (`workspaceTools.ts`, `outlineWorkspaceTool.ts`); HITL approve `message` in `agentHitl.ts`; UI **secretHint** in `AgentToolActivity.tsx`. **AGENT_DISABLE_SECRET_LEAK_SCAN** disables. Heuristic only; assistant token stream not scanned
- [ ] MCP server credentials stored encrypted in session storage

### 🛡️ Action Guards
- [x] Destructive actions (delete, force-push, drop table) require confirmation — Writes/shell/delete/copy/move file tools use HITL when `AGENT_REQUIRE_APPROVAL_FOR_WRITES` is set
- [x] Agent cannot modify files outside the open workspace
- [x] Agent cannot install global packages without user approval — Shell allowlist + optional approval
- [ ] Audit log of all agent actions (tool + args + result) persisted per session

**PRD:** [`PRD.md` §11.12](PRD.md#prd-phase-12) — Phase 12 *(keep in sync).*

---

## 📊 Progress Tracker

Counts are from **checkbox rows only** (`- [ ]` / `- [x]`). Several `[x]` rows are explicitly **partial** (see prose on that line). This is a **guide**, not a strict KPI.

| Phase | Total rows | Done (`[x]`) | Notes |
|-------|------------|--------------|--------|
| Phase 1 — Tool Use Foundation | 19 | 19 | All rows checked (several partial); includes **read_documentation** + heuristic outline; not LSP/AST |
| Phase 2 — LangGraph Orchestration | 22 | 12 | `createReactAgent` + HITL + **AGENT_READ_ONLY**; no custom planner/checkpoint |
| Phase 3 — Monaco Editor | 23 | 13 | + **path:line** from chat → reveal line; optional format on **manual** save; breadcrumbs; sticky scroll; ⌘/Ctrl+L; **⌘/Ctrl+K** → chat; no inline ghost / LSP |
| Phase 4 — Terminal | 15 | 15 | All rows checked (several partial); + numbered/preset tab names, **Bot** hint, xterm, PTY, splits, `pasteAndRun` |
| Phase 5 — Cline Editing | 15 | 2 | Cline **chat** backend only; **collapsible** unified diff in **chat** markdown; extension-style Monaco apply/undo still absent |
| Phase 6 — MCP Integrations | 14 | 1 | **`.mcp.json`** discovery + editor badge; no MCP runtime |
| Phase 7 — Context & Memory | 13 | 4 | + pin-file prompt snapshots; still no embeddings / semantic index |
| Phase 8 — Planning & Reasoning | 13 | 4 | + **workspaceDirtyPaths** client guard on mutating tools + HITL approve |
| Phase 9 — Code Quality & Safety | 17 | 1 | Write-tests quick action + prompt hint; no auto test/lint gates |
| Phase 10 — UX & DX | 30 | 30 | + **⌘/Ctrl+Z** docs (Monaco + chat); **interrupted-stream** banner; **`graph_phase`**; palette; **fenced diff/patch**; session tokens; tool timing; quick actions |
| Phase 11 — Performance | 14 | 8 | + **interrupted stream** notice after refresh; slow-stream footer; workspace editor 30s auto-save; UI error boundaries; agent stream retry; dev tool timing; `/api/health` + SQLite persistence |
| Phase 12 — Security | 12 | 7 | + secret redaction on tool previews, HITL messages, and **read/outline** tool output; still no audit log DB |
| **Total** | **207** | **116** | **~56%** of rows checked; many phases are **not** complete by design |

**Next high-impact gaps:** MCP (Phase 6), vector codebase index (Phase 7), automated test/lint loop (Phase 9), Monaco **inline** ghost agent + diff review (Phase 3), Cline-extension-style apply/undo (Phase 5). Phase 1 checklist rows are complete; deeper doc UX (name→URL, embeddings) remains out of scope.

**PRD:** Keep the §11 summary table and subsection text in [`PRD.md`](PRD.md#prd-agent-roadmap) aligned with the “Total rows / Done” column here.

---

> 💡 **Cursor tip:** Use `Cmd+Shift+F` to search `- [ ]` to find all unchecked items.  
> Use `Cmd+K` on any section header to ask the agent to implement that phase.
