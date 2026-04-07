# 🖥️ TerminalAI — Product Requirements Document

> **Version:** 1.0.0  
> **Date:** 2026-04-03  
> **Status:** Ready for Cursor Implementation  
> **Cursor Instruction:** Read this PRD + `CHECKLIST.md` + `AGENT_IMPROVEMENT_CHECKLIST.md` (roadmap) before writing a single line of code. Clone repos listed here, copy relevant files, then build on top of them.

**Agent roadmap vs v1 PRD:** Detailed checkbox work lives in `AGENT_IMPROVEMENT_CHECKLIST.md`. **§11 below** records implementation status **by phase** for the PRD; keep §11 and the checklist aligned when you ship agent features.

---

## 1. Overview

**TerminalAI** is a VS Code–style browser-based IDE panel that combines a fully functional terminal (with Fish shell support), a 450px-wide AI chatbot sidebar, and a lightweight agent — all wired together so the user can click an error in the terminal, ask the AI about it, get a runnable command back, and execute it with one button click.

### Core Philosophy
- **Don't build from scratch.** Clone existing best-in-class repos and wire them together.
- **One panel, all power.** Terminal + Chat + Agent in a single cohesive UI.
- **Multi-provider AI.** Any API key, any model, including local Ollama/LM Studio models.
- **Fish-first terminal.** Fish shell as the default with full feature support.

---

## 2. Repos to Clone — Cursor MUST Use These

> Cursor: Clone each repo into the `/vendor` directory inside the project root. Do NOT rewrite what these repos already do.

| Purpose | Repo | Clone Path |
|---|---|---|
| Web terminal (xterm.js-based, React) | `https://github.com/nicholasgasior/react-terminal-ui` OR `https://github.com/rohanchandra/react-terminal-component` | `vendor/terminal` |
| Full-featured web terminal with split support | `https://github.com/mxswd/swift-terminal` OR best option: **`https://github.com/coder/code-server`** (extract terminal module only) | `vendor/terminal-core` |
| xterm.js (core terminal renderer) | `https://github.com/xtermjs/xterm.js` | (install via npm, do not clone) |
| AI chat UI | `https://github.com/mckaywrigley/chatbot-ui` | `vendor/chat-ui` |
| Multi-provider LLM SDK | `https://github.com/vercel/ai` (Vercel AI SDK) | (install via npm) |
| Lightweight agent framework | `https://github.com/lgrammel/modelfusion` OR `https://github.com/hwchase17/langchainjs` | `vendor/agent` |
| Local model support (Ollama) | `https://github.com/ollama/ollama-js` | (install via npm) |
| Fish shell in browser (via WASM) | `https://github.com/nickel-lang/fish-wasm` or use **`https://github.com/nicowillis/webshell`** | `vendor/fish-shell` |

### Cursor Step-by-Step Repo Setup
```bash
# Run from project root
mkdir -p vendor

# 1. Clone chat UI base
git clone https://github.com/mckaywrigley/chatbot-ui vendor/chat-ui

# 2. Clone xterm-based terminal
git clone https://github.com/nicholasgasior/react-terminal-ui vendor/terminal

# 3. Copy relevant source files into /src
cp -r vendor/chat-ui/components/Chat src/components/ChatBase
cp -r vendor/terminal/src src/components/TerminalBase
```

---

## 3. Project Structure

```
terminalai/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Terminal/
│   │   │   ├── TerminalPanel.tsx          # Main terminal wrapper
│   │   │   ├── TerminalInstance.tsx       # Single xterm.js instance
│   │   │   ├── TerminalSplitDropdown.tsx  # Split/new tab/new window dropdown
│   │   │   ├── TerminalTabBar.tsx         # Tab bar for multiple terminals
│   │   │   └── ErrorHighlighter.tsx       # Detects & highlights errors in output
│   │   ├── Chat/
│   │   │   ├── ChatSidebar.tsx            # 450px chat panel
│   │   │   ├── ChatMessage.tsx            # Individual message bubble
│   │   │   ├── ChatInput.tsx              # Input + send button
│   │   │   ├── CommandButton.tsx          # Inline "▶ Run" button in AI responses
│   │   │   └── ErrorReference.tsx         # Clickable error badge in chat
│   │   ├── Agent/
│   │   │   ├── AgentCore.tsx              # Lightweight agent loop
│   │   │   └── AgentActions.ts            # Terminal write, file ops, etc.
│   │   ├── ModelSelector/
│   │   │   ├── ModelDropdown.tsx          # Switch model mid-chat
│   │   │   └── ApiKeyModal.tsx            # Add/manage API keys
│   │   └── Layout/
│   │       └── MainLayout.tsx             # Terminal (left) + Chat (right, 450px)
│   ├── hooks/
│   │   ├── useTerminal.ts                 # xterm.js lifecycle + write/read
│   │   ├── useTerminalSplit.ts            # Split state management
│   │   ├── useChatStream.ts               # Streaming AI responses
│   │   ├── useErrorCapture.ts             # Capture stderr → chat reference
│   │   └── useLocalModels.ts              # Auto-discover Ollama/LM Studio
│   ├── providers/
│   │   ├── llm/
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   ├── gemini.ts
│   │   │   ├── groq.ts
│   │   │   ├── mistral.ts
│   │   │   ├── ollama.ts                  # Local Ollama models
│   │   │   ├── lmstudio.ts                # Local LM Studio (OpenAI-compat)
│   │   │   └── index.ts                   # Provider registry
│   │   └── agent/
│   │       └── lightweightAgent.ts
│   ├── store/
│   │   ├── terminalStore.ts               # Zustand store for terminal state
│   │   ├── chatStore.ts                   # Chat history, model selection
│   │   └── settingsStore.ts               # API keys, preferences
│   ├── styles/
│   │   ├── globals.css
│   │   ├── terminal.css
│   │   └── chat.css
│   ├── types/
│   │   ├── terminal.ts
│   │   ├── chat.ts
│   │   └── models.ts
│   ├── utils/
│   │   ├── errorParser.ts                 # Parse stderr for clickable errors
│   │   ├── commandExtractor.ts            # Extract shell cmds from AI response
│   │   └── localModelDiscovery.ts         # Ping Ollama/LM Studio on startup
│   └── App.tsx
├── vendor/                                # Cloned repos (gitignored sub-content)
│   ├── chat-ui/
│   ├── terminal/
│   └── agent/
├── server/
│   ├── index.ts                           # Express/node-pty WebSocket server
│   ├── pty.ts                             # node-pty shell spawner (Fish default)
│   └── shellBridge.ts                     # Relay terminal I/O over WebSocket
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── PRD.md                                 # This file
└── CHECKLIST.md                           # Cursor's build checklist
```

---

## 4. Features — Detailed Specs

### 4.1 Terminal Panel

**Fish Shell First**
- Default shell: `fish` (fallback: `bash` → `sh`)
- Auto-detect if Fish is installed on server; install hint if not
- Fish completions, syntax highlighting, and history via node-pty pass-through

**xterm.js Integration**
- Use `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links` + `@xterm/addon-search`
- WebSocket bridge to `node-pty` on server for real PTY support
- Font: `JetBrains Mono` or `Fira Code` — monospace with ligatures
- Theme: Dark by default, synced with overall app theme

**Terminal Split & Navigation Dropdown**
```
[ ⊞ Terminal ▼ ]
  ├─ Split Horizontally
  ├─ Split Vertically  
  ├─ New Tab
  ├─ Open in New Window
  └─ Close Panel
```
- Dropdown trigger: small icon button in terminal header bar
- Splits managed with CSS Grid / flex — resizable via drag handles
- Each split is an independent PTY session

**Error Highlighting**
- Regex scan of terminal output for patterns: `Error:`, `error:`, `FAILED`, `npm ERR!`, `SyntaxError`, `Traceback`, `fatal:`, `ENOENT`, etc.
- Highlighted errors render as clickable orange underlined spans
- Clicking an error → auto-populates chat input with: `[Error from terminal]: <error text>` and focuses chat

### 4.2 Chat Sidebar — 450px Fixed Width

**Layout**
```
┌─────────────────────────────────────────┐ 450px
│  🤖 TerminalAI  [model: gpt-4o ▼] [⚙]  │
├─────────────────────────────────────────┤
│                                         │
│  [messages scroll area]                 │
│                                         │
│  ┌─ AI Message ──────────────────────┐  │
│  │ Here's the fix. Run this:         │  │
│  │ ┌──────────────────────────────┐  │  │
│  │ │ npm install --legacy-peer-.. │▶ │  │  ← CommandButton (pastes + runs)
│  │ └──────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [📎] [error ref] Type a message... [↑] │
└─────────────────────────────────────────┘
```

**CommandButton (`▶` Run Button)**
- Every code block in AI response that contains a shell command gets a small `▶` icon button on the right
- On click: paste command into active terminal AND execute (send `\n`)
- Visual feedback: button briefly turns green ✓ after execution
- Button size: 20×20px icon, not full-width

**Error Reference Badge**
- When user clicks an error in the terminal, a small badge appears in chat input: `⚠ error ref attached`
- The full error context is appended to the prompt sent to the AI (not shown in UI verbatim)

**Streaming Responses**
- Stream tokens as they arrive (SSE / ReadableStream)
- Typing indicator during initial response latency
- Abort button to stop generation mid-stream

### 4.3 Model Selection

**Supported Providers (out of the box)**
| Provider | Models | Auth |
|---|---|---|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo, o1, o3-mini | API Key |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 | API Key |
| Google | gemini-2.0-flash, gemini-1.5-pro | API Key |
| Groq | llama-3.3-70b, mixtral-8x7b | API Key |
| Mistral | mistral-large, codestral | API Key |
| Ollama | auto-discovered from `localhost:11434` | None |
| LM Studio | auto-discovered from `localhost:1234` | None |
| OpenAI-compat | Any custom base URL | API Key optional |

**Model Switcher UI**
- Dropdown in chat header — shows provider icon + model name
- Grouped by provider
- Local models section auto-populated on app load (ping Ollama/LM Studio)
- "Add API Key" option opens a modal; keys stored in `localStorage` (encrypted with a simple passphrase)

**API Key Management Modal**
```
┌── API Keys ─────────────────────────────┐
│  OpenAI    [sk-••••••••••••••] [Edit]   │
│  Anthropic [sk-ant-•••••••••] [Edit]   │
│  Groq      [ Add key...     ] [+ Add]  │
│                                         │
│  Custom provider:                       │
│  Base URL: [https://api.example.com/v1] │
│  API Key:  [••••••••••]                 │
│  Model:    [my-model-name]              │
│                              [Save]     │
└─────────────────────────────────────────┘
```

### 4.4 Local Model Auto-Discovery

On app start (and on a 30-second interval):
1. `GET http://localhost:11434/api/tags` → parse Ollama model list
2. `GET http://localhost:1234/v1/models` → parse LM Studio model list
3. Merge into provider registry under "Local" group
4. Show green dot indicator in model dropdown if local models found

### 4.5 Lightweight Agent

**Capabilities**
- **Read terminal output** → understand current working directory, recent errors
- **Write to terminal** → execute commands on user approval
- **File awareness** → list files in CWD, read file contents (via terminal `cat`)
- **Web search** (optional, if Brave/Serper API key provided)

**Agent Loop (single-step, not recursive by default)**
```
User message → Agent analyzes → 
  if needs terminal info → reads last N lines of terminal output →
  if needs to run cmd → proposes cmd with ▶ button →
  returns final answer
```

**Safety**
- Agent NEVER auto-runs commands without user clicking ▶
- Destructive commands (`rm -rf`, `DROP TABLE`, etc.) flagged with ⚠️ warning badge
- User can toggle "Agent mode" on/off in settings

### 4.6 Fish Shell Features

- **Auto-suggestions**: Pass-through from Fish shell (appears in terminal naturally)
- **Syntax highlighting**: Fish handles this natively in PTY
- **Abbreviations**: Fish `abbr` commands work as normal
- **Custom Fish config**: Users can edit `~/.config/fish/config.fish` from chat (`/edit-fish-config` slash command)
- **Theme**: Support `fish_config` theme changes reflected in terminal

---

## 5. Technical Architecture

```
Browser                              Server (Node.js)
────────────────────────             ─────────────────────
React App                            Express + WS Server
  ├─ xterm.js                ←WS──→  node-pty (Fish/bash)
  ├─ Chat UI (450px)          HTTP→  /api/chat  (stream)
  ├─ Model Registry           HTTP→  /api/models
  └─ Agent Core               HTTP→  /api/agent
                              HTTP→  LLM Provider APIs
                                     (OpenAI, Anthropic, etc.)
```

**Stack**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- State: Zustand
- Terminal: xterm.js + node-pty (server-side)
- AI SDK: Vercel AI SDK (`ai` package) for unified provider interface
- Local models: `ollama` npm package + OpenAI-compat for LM Studio
- WebSocket: `ws` package on server, native WebSocket in browser
- Server: Express + Node.js (TypeScript)

---

## 6. UI/UX Specifications

### Color Palette (Dark Theme Default)
```
Background:       #0d1117  (GitHub dark)
Terminal bg:      #0a0e13
Chat sidebar bg:  #161b22
Panel borders:    #30363d
Text primary:     #e6edf3
Text secondary:   #8b949e
Accent blue:      #58a6ff
Accent green:     #3fb950  (success / run button)
Accent orange:    #f0883e  (errors / warnings)
Accent red:       #ff7b72  (destructive actions)
```

### Typography
- UI font: `Inter` or system-ui
- Terminal font: `JetBrains Mono`, `Fira Code`, fallback `monospace`
- Chat font size: 14px
- Terminal font size: 13px

### Responsive Behavior
- Chat sidebar: fixed **450px** on viewports **≥900px**, collapsible via toggle button (`MainLayout.tsx`)
- Terminal: fills remaining width
- Minimum total width: 900px for the side‑by‑side desktop layout
- Below 900px: chat becomes a **right slide-over** (max width 450px) with a dimmed backdrop; tap backdrop to dismiss

---

## 7. Files to Add to Root for GitHub Readiness

- `README.md` — setup guide, feature list, screenshots placeholder
- `LICENSE` — MIT
- `.gitignore` — node_modules, .env, vendor sub-repos, dist
- `.env.example` — all env vars documented
- `CONTRIBUTING.md` — how to add a new LLM provider
- `SECURITY.md` — API key storage policy
- `package.json` — with all deps listed
- `docker-compose.yml` — optional: containerized server + client

---

## 8. Environment Variables

```bash
# .env.example

# Server
PORT=3001
SHELL_DEFAULT=fish      # fish | bash | sh | zsh

# Optional server-side API keys (can also be set per-user in UI)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=

# Local model endpoints
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://localhost:1234

# Agent
ENABLE_AGENT=true
AGENT_MAX_STEPS=5
```

---

## 9. Out of Scope (v1)

- Authentication / multi-user
- Cloud terminal hosting (server must run locally)
- VS Code extension version
- Mobile support
- Voice input
- **Full parity with `AGENT_IMPROVEMENT_CHECKLIST.md`** — that file is a long-horizon roadmap (MCP, vector codebase index, Cline-extension-style diff/undo, automated lint/test gates, etc.). v1 PRD success criteria do **not** require completing every phase there; use the checklist’s **Phase roll-up** table for shipped-vs-aspirational status.

---

## 10. Success Criteria

- [ ] Terminal opens with Fish shell by default in < 1 second _(Fish is the default when installed; cold-start latency depends on host)_
- [x] User can click an error → chat auto-populates → AI responds with command → user clicks ▶ → command runs
- [x] Model can be switched mid-conversation without losing context
- [x] Ollama local models appear automatically in model list if Ollama is running
- [x] Terminal can be split, opened in new tab, and opened in new window
- [x] Chat sidebar is exactly 450px wide and collapsible _(450px at ≥900px viewport; slide-over below 900px)_

---

## 11. Agent roadmap — implementation status by phase

<a id="prd-agent-roadmap"></a>

> **Checklist:** `AGENT_IMPROVEMENT_CHECKLIST.md` (granular `[x]` / `[ ]` rows).  
> **Maintenance rule:** When a phase’s scope changes in code, update **this §11 subsection** and the **matching checklist phase** in the same commit or PR. Counts below are **checkbox rows** in the checklist (partial items still count as one row). **Stable link targets:** `#prd-agent-roadmap` (§11 top), `#prd-phase-1` … `#prd-phase-12` (each subsection); the checklist’s end-of-phase **PRD** lines use these anchors.

**Roll-up (mirrors checklist “Phase roll-up” table):** Phases **1–4, 10** (all checkbox rows have at least partial coverage), **12** are *partially* shipped; **5–7, 8–9, 11** are *minimal, alternate, or not implemented* relative to the aspirational checklist — **not** “all phases complete.”

| Phase | Checklist rows done | Status |
|-------|---------------------|--------|
| 1 — Tools | 19 / 19 | Partial |
| 2 — LangGraph | 12 / 22 | Partial |
| 3 — Monaco | 13 / 23 | Partial |
| 4 — Terminal | 15 / 15 | Strong |
| 5 — Cline extension-style | 1 / 15 | Backend only |
| 6 — MCP | 1 / 14 | Minimal (config discovery only) |
| 7 — Context & memory | 4 / 13 | Minimal |
| 8 — Planning | 4 / 13 | Minimal |
| 9 — Quality gates | 1 / 17 | Not implemented as auto gates |
| 10 — UX | 30 / 30 | Partial (all rows checked; several partial) |
| 11 — Performance | 8 / 14 | Minimal |
| 12 — Security | 7 / 12 | Partial |
| **Total** | **116 / 207** | **~56%** |

### 11.1 Phase 1 — Tool Use Foundation

<a id="prd-phase-1"></a>

**Status:** Partial. **Shipped:** Workspace read/write, search-replace, list, find files, grep contents (default excludes for `.git`, `node_modules`, build artifacts, and common secret `.env*` basenames — see `server/agent/workspaceGrepTool.ts`), path stat, **delete/copy/move regular files** (empty-dir delete optional), same sandbox + optional write-approval as other mutating tools (`server/agent/workspaceTools.ts`, `server/agent/graph.ts`); **package registry tools** — **search_npm_packages** (npmjs search API) and **lookup_pypi_project** (PyPI JSON API, exact project name), wired in `server/agent/registrySearchTools.ts` and `graph.ts`, disable with **AGENT_DISABLE_PACKAGE_REGISTRY_TOOLS**; **fetch_url** — HTTPS GET with **hostname allowlist**, private-IP block, **manual redirect** validation each hop, HTML→text and JSON formatting, size/timeout caps (`server/agent/fetchUrlTool.ts`, **AGENT_FETCH_URL_*** / **AGENT_DISABLE_FETCH_URL**); **read_documentation** — same fetch policy as **fetch_url**, returns **one overlapping text chunk** per tool call for long pages (`server/agent/readDocsTool.ts`, shared **fetchAllowlistedUrlAsPlainText**; **AGENT_READ_DOCS_CHUNK_CHARS**, **AGENT_DISABLE_READ_DOCS**); **web_search** — DuckDuckGo **instant answer** JSON API (`server/agent/webSearchTool.ts`, **AGENT_DISABLE_WEB_SEARCH**), not a full SERP and not Brave/Serper/Tavily; **find_workspace_symbol** / **find_workspace_references** — ripgrep **word-boundary** identifier search (`server/agent/symbolWorkspaceTools.ts`, shared **runWorkspaceContentGrep** in `workspaceGrepTool.ts`), not LSP/AST; **get_workspace_file_outline** — heuristic line/regex outline for TS/JS (incl. Vue/Svelte), Python, Go, Rust, Markdown (`server/agent/outlineWorkspaceTool.ts`), capped entries, same read-size sandbox as file reads — not a language-server or AST outline. **Gaps:** No doc “name → URL” resolver or curated doc index; no paid/structured web search APIs; no fuzzy PyPI search; no recursive directory tree delete in-tool; no LSP/AST outline or true “find references”.

### 11.2 Phase 2 — LangGraph Orchestration

<a id="prd-phase-2"></a>

**Status:** Partial. **Shipped:** LangGraph `createReactAgent` loop, tool streaming (`server/agent/runAgent.ts`) including coarse **`graph_phase`** events (`model` vs `tool`, optional `langgraph_node` from stream metadata) for live UI (`streamProtocol.ts`, `chatStore.agentGraphPhase`, `ChatSidebar.tsx`); HITL approvals (`pendingApprovalsStore`, approval routes), env limits (`AGENT_MAX_STEPS`, `AGENT_RECURSION_LIMIT`, `AGENT_TOOL_REPEAT_GUARD`); **read-only mode** via **AGENT_READ_ONLY** — mutating workspace tools and **run_workspace_command** are not registered (`approvalEnv.ts`, `workspaceTools.ts`, `shellTool.ts`, prompt note in `graph.ts`). **Gaps:** No dedicated planner/observer/error-handler nodes, checkpointing, or parallel subgraphs.

### 11.3 Phase 3 — Monaco Editor Integration

<a id="prd-phase-3"></a>

**Status:** Partial. **Shipped:** Multi-tab workspace editor, file sidebar, theming, minimap, folding, **sticky scroll** (indentation-based sticky lines, `stickyScroll` in `WorkspaceEditorPanel.tsx`), **file path breadcrumb** row above the editor (`BreadcrumbPath`: parent path segments are buttons that set the quick-open field for Enter/Open — not LSP symbol breadcrumbs), assistant chat inline `` `path:line` `` / `` `path#L42` `` links (`parseWorkspacePathWithLine` in `workspacePathHeuristic.ts`, `ChatMessage.tsx`) open the workspace editor and **reveal** that line (`workbenchStore.openEditorFileLine`, `WorkspaceEditorPanel` — not gutter decorations or a live agent cursor), multi-cursor (Monaco defaults), basic suggestions, **user-adjustable code font size** (10–22px from prefs, `WorkspaceEditorPanel.tsx`); optional **format on manual save** — when enabled in **API keys** → Workspace editor, **Ctrl/Cmd+S** and the Save button run Monaco **`editor.action.formatDocument`** when supported, then persist (`workspace_format_on_save` on `app_prefs`, migration `009_workspace_format_on_save.sql`); **30s auto-save** does not format; **⌘/Ctrl+L** opens the agent panel, focuses chat, and **prepends the active workspace file path** to the chat input when a tab is open (`workbenchStore.activeWorkspaceEditorPath`, `chatStore.injectWorkspaceEditorFileContext`, `useWorkbenchHotkeys`); **⌘/Ctrl+K** in the workspace Monaco editor opens the agent panel with **active file** + **fenced selection** in the chat input when the selection is non-empty (`chatStore.openAgentWithWorkspaceEditorSelection`, Monaco `addCommand` in `WorkspaceEditorPanel.tsx`); the editor surface is marked `data-terminalai-no-palette` so the global **⌘/Ctrl+K** shortcuts handler does not steal the chord — use **⌘/Ctrl+Shift+K** or **⌘/Ctrl+Shift+P** to open the **command palette** from the editor (`useKeyboardShortcutsPalette.tsx`). **Gaps:** No Copilot-style inline ghost completions, no inline diff review, no LSP server integration, no font-family picker; format-on-save is Monaco built-in only (not Prettier/Black/rustfmt CLI).

### 11.4 Phase 4 — Terminal Integration

<a id="prd-phase-4"></a>

**Status:** Strong relative to checklist (all Phase 4 checkbox rows are at least partially met). **Shipped:** xterm.js, PTY sessions, splits/tabs, agent shell tool when enabled, `pasteAndRun` / `CommandButton`, OSC cwd integration, **code font size** synced with workspace editor prefs (`TerminalInstance.tsx`); terminal panel toolbar **Clear display** and **Send Ctrl+C**; **tab titles** default to **`Terminal 1`**, **`Terminal 2`**, … for new and split tabs (`nextNumberedTerminalTabTitle` in `terminalStore.ts`); **Terminal** layout dropdown offers **New tab: Dev server | Tests | Agent | Build | Logs** (`TERMINAL_TAB_NAME_PRESETS`, `TerminalSplitDropdown.tsx`); double-click rename on tabs; while a **LangGraph** agent stream is active, if **`run_workspace_command`** is running or awaiting approval, the matching tab shows a **Bot** icon + tooltip (`chatStore.agentStreamShellSessionId`, `TerminalTabBar.tsx`). **Gaps:** No full-screen “agent owns terminal” mode; no “kill PTY / close shell” distinct from Ctrl+C; badge is session-scoped (subprocess-only shell has no tab).

### 11.5 Phase 5 — Cline Agentic Editing

<a id="prd-phase-5"></a>

**Status:** Cline **chat proxy** only, not extension-style editing. **Shipped:** Optional backend path `server/routes/clineAgent.ts` + UI backend toggle; assistant **fenced `diff` / `patch`** blocks in chat support **collapsible** inline preview + **full-diff** dialog (`ChatDiffFence.tsx`). **Gaps:** File mutations are **not** routed through Cline’s diff/apply/undo pipeline; no Monaco preview/rollback for Cline patches; no per-hunk apply from chat.

### 11.6 Phase 6 — MCP Tool Integrations

<a id="prd-phase-6"></a>

**Status:** Not implemented as a **runtime** integration. **Partial:** If the workspace root contains **`.mcp.json`** with a top-level **`mcpServers`** object (Cursor / VS Code style), the workspace editor toolbar shows an **MCP · N servers** badge and tooltip listing server names (`WorkspaceMcpConfigBadge.tsx`, `mcpConfigParse.ts`); invalid JSON shows a warning tooltip. Example: **`.mcp.json.example`**. **Gaps:** No MCP client, no tool discovery, no LangGraph tool nodes for MCP.

### 11.7 Phase 7 — Context & Memory

<a id="prd-phase-7"></a>

**Status:** Minimal. **Shipped:** SQLite persistence for conversations, messages, app prefs; agent POST may include `workspaceRoot` and `clineLocalBaseUrl` (`src/store/chatStore.ts`, `server/routes/persistence.ts`); **code search** via `grep_workspace_content` uses fixed exclude globs (noisy dirs + secret-style env files) and ripgrep’s default `.gitignore` respect — not a codebase embedding index; **pin-file context** — up to eight workspace-relative paths in `agent_pinned_paths_json`, snapshots appended to the agent system prompt each run (`server/agent/pinnedFilesPrompt.ts`, `runAgent.ts`, UI in `WorkspaceEditorPanel.tsx` + `ApiKeyModal.tsx`). **Gaps:** No vector index, semantic codebase search, or structured long-term “memory” beyond prefs and pins.

### 11.8 Phase 8 — Planning & Reasoning

<a id="prd-phase-8"></a>

**Status:** Minimal. **Shipped:** Step limits and tool repeat guard (see §11.2); optional **AGENT_ENFORCE_READ_BEFORE_WRITE** — mutating tools refuse paths not yet read this request via **read_workspace_file** or **get_workspace_file_outline** (`workspaceReadBeforeWrite.ts`, wired from `runAgent.ts`); **unsaved workspace editor buffers** — the web UI syncs dirty tab paths to **`workbenchStore.dirtyWorkspacePaths`** and sends **`workspaceDirtyPaths`** on **`POST /api/agent`** and on **`POST /api/agent/cline`** when Cline uses the **LangGraph tools** path (i.e. **`CLINE_AGENT_DISABLE_TOOLS`** is not `1`); plain Cline proxy mode does not run workspace tools. Server-side refusal and HITL approve behavior match §11.2 wiring (`workspaceClientDirtyPaths.ts`, `executeApproval.ts`, `graph.ts`). **Gaps:** No tree-of-thought, self-critique, or sub-agents; plain Cline proxy ignores dirty paths; client-reported list is not cryptographically verified.

### 11.9 Phase 9 — Code Quality & Safety

<a id="prd-phase-9"></a>

**Status:** Not implemented as **automated** product gates (no auto-run test/lint loop, no block-on-apply). **Partial:** Agent system prompt encourages suggesting or running tests after substantive edits when `run_workspace_command` fits (`server/agent/graph.ts`); **⌘/Ctrl+K** (outside the workspace editor) or **⌘/Ctrl+Shift+K** / **⌘/Ctrl+Shift+P** opens the **command palette** with **Write tests for this** and related **agent quick actions** (explain code/file, generate docs, find bugs), which prefill the chat input—optionally prefixed with the **active workspace file** when a tab is open (`KeyboardShortcutsDialog.tsx`). Tests and linters remain primary for humans/CI.

### 11.10 Phase 10 — UX & Developer Experience

<a id="prd-phase-10"></a>

**Status:** Partial. **Shipped:** Streaming chat, code blocks (assistant fenced **`diff`** / **`patch`** blocks render with **+/-** tinting, copy, **collapsible** inline preview (header chevron), and a **full-diff** dialog — `ChatDiffFence.tsx` / `ChatMessage.tsx`), **⌘/Ctrl+Z** / **⌘/Ctrl+Shift+Z** documented in the **command palette** for **Monaco** (native undo stack) and the **chat textarea** (browser undo) — not a unified “undo last agent mutation” stack; **banner** after reload if **`pagehide`** occurred during an active agent stream (`useAgentStreamInterruptedNotice`, `agentStreamInterruptedNotice.ts` — informational, not SSE resumption), regenerate/rewrite, collapsible tool activity (**Tools** rows show **server-reported `elapsedMs`** per finished tool via `tool_done` in `runAgent.ts` / `AgentToolActivity.tsx`), **session token totals** when the upstream model reports **`usage_metadata`** (`on_chat_model_end` → stream **`usage`** events; `chatStore.sessionTokenUsage`; badge under model selector in `ChatSidebar.tsx` — LangGraph agent path only; resets on New chat / Clear chat / delete active conversation), **“What is the agent doing?”** while streaming — native **`title`** plus a help icon tooltip on the **Generating** row (`ChatSidebar.tsx`), driven by `describeAgentLiveActivity` in `src/lib/agentActivitySummary.ts` (pending HITL / running tools / **`graph_phase`** hint / generic reasoning); a small **Model** / **Tool · …** badge beside **Responding…** reflects the latest **`graph_phase`** line from the TerminalAI agent stream (not emitted for plain Cline chat), clear/new chat; **clickable inline workspace paths** in assistant markdown (heuristic) open the **workspace editor** (`requestOpenEditorFile` / `workbenchStore`); **⌘/Ctrl+L** opens the agent panel, focuses chat, and **prepends the active workspace file path** to the input when a tab is open (`injectWorkspaceEditorFileContext`); **⌘/Ctrl+Backtick**, **⌘/Ctrl+B** (`useWorkbenchHotkeys`); **⌘/Ctrl+Shift+K** and **⌘/Ctrl+Shift+P** toggle the **command palette** (`KeyboardShortcutsDialog.tsx`, filterable list of shortcuts, quick actions, and terminal commands — including from inside the workspace editor); **⌘/Ctrl+K** toggles the same dialog when focus is **not** in `[data-terminalai-no-palette]` (workspace Monaco uses **⌘/Ctrl+K** for **agent chat with selection** — see §11.3); the palette includes **Run in terminal** actions (`npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build`, `git status`, **Commit & push (WIP message)** — `git add -A`, generic commit message, `git push`) via `pasteAndRun` on the focused terminal tab, plus **agent quick prompts** — **Write tests for this**, **Explain code / file**, **Generate docs for file**, **Find bugs in file** — each prefills chat (with the active workspace file noted when the editor has a tab open); **theme preference** dark / light / system (`color_scheme`) and **code font size** 10–22px (`code_font_size_px` on `app_prefs`) persisted in SQLite, surfaced under **API keys** → Appearance; **agent verbosity** (`agent_verbosity`), **optional project hints** (`agent_context_hints`, up to 4000 chars), and **Auto vs confirm mutations** (`agent_mode` / `agentAutoMode`: `agent_mode=0` / `agentAutoMode=false` means file and shell tools always enqueue HITL before running, in addition to `AGENT_REQUIRE_APPROVAL_*`) under **Agent behavior** in `ApiKeyModal.tsx`, with prompt hints in `server/agent/graph.ts` and runtime prefs via `loadAgentRuntimePrefs`. **PRD §4.2/§6 layout:** agent chat column is **450px** fixed at viewport **≥900px**; below 900px it is a **right slide-over** (max 450px) with a dimmed backdrop (`MainLayout.tsx`). **Gaps:** No Copilot-style **inline** ghost agent UI; no natural-language / intent-routed command palette (filter is substring match only); no separate docked quick-actions panel; path detection is heuristic-only; no font-family picker; chat sidebar body size not separately configurable.

### 11.11 Phase 11 — Performance & Reliability

<a id="prd-phase-11"></a>

**Status:** Minimal. **Shipped:** `GET /api/health`, SQLite-backed session persistence; **agent chat POST** uses **retry + exponential backoff** on 408/429/502/503/504 and network errors (`fetchAgentStreamWithRetry` in `src/lib/agentStreamFetch.ts`); **streaming** shows partial assistant text as it arrives; after **~4s** of an active stream without completion, the chat footer adds a **slow provider / incremental text** note (`ChatSidebar.tsx`); **post-refresh notice** when the tab was unloaded during streaming (`sessionStorage` on **`pagehide`**, `ChatSidebar.tsx`) — explains truncated replies, **not** upstream stream resume; in **Vite dev only**, tool stream lines log to the console with **server `elapsedMs` on `tool_done` when present** (else client-side delta) via `withDevAgentStreamTelemetry`; **React error boundaries** around major panes — chat, workspace editor, and terminal (`UiErrorBoundary` in `MainLayout.tsx`, `TerminalOnlyPage.tsx`) with user **Try again** remount; **workspace editor auto-save** every 30s for **dirty** Monaco tabs (`WorkspaceEditorPanel.tsx` → `PUT /api/workspace/file`). **Gaps:** No formal latency SLOs, true **resume** of an interrupted provider stream, or mid-stream chunk retry; auto-save is editor-only (not a global “all files in repo” snapshot); not every leaf widget wrapped individually.

### 11.12 Phase 12 — Security & Sandboxing

<a id="prd-phase-12"></a>

**Status:** Partial. **Shipped:** Workspace path sandbox (`server/lib/workspacePathSandbox.ts` and related), optional allowlists, HITL for writes/shell when configured, API key handling patterns; **grep_workspace_content** skips common secret env filenames (while leaving `.env.example` and similar searchable); **heuristic secret redaction** on LangGraph **tool_done** previews/errors (`server/lib/agentSecretLeak.ts`, `runAgent.ts`), on **read_workspace_file** (full file and line-range reads) and **get_workspace_file_outline** output (`workspaceTools.ts`, `outlineWorkspaceTool.ts`), and on **HITL approve** JSON `message` (`server/routes/agentHitl.ts`), with optional **secretHint** in the stream for the tool UI (`streamProtocol.ts`, `AgentToolActivity.tsx`); redacted reads append a short **Server note** for the model; disable with **AGENT_DISABLE_SECRET_LEAK_SCAN**. **Gaps:** No Docker/WebContainer command sandbox, no persisted audit log of every tool call, no scanning of free-form assistant chat tokens (on-disk file bytes are unchanged; only tool-returned strings are redacted).
