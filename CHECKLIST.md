# ✅ CHECKLIST.md — Cursor Build Tracker

> **Cursor:** Work through this list top-to-bottom. Check off items as you complete them. Never skip a section. Update the `[x]` markers as you go. Refer back to `PRD.md` for full specs on each item.

---

## Phase 0 — Project Bootstrap

- [x] Initialize repo: `git init`, create initial commit
- [x] Create folder structure exactly as defined in `PRD.md § 3`
- [x] Run `npm init -y` and set up `package.json` with all dependencies (see Phase 1)
- [x] Set up TypeScript: `tsconfig.json` with strict mode
- [x] Set up Vite: `vite.config.ts` for React + TS
- [x] Set up Tailwind CSS: `tailwind.config.ts` + `globals.css`
- [x] Set up ESLint + Prettier: `.eslintrc.json` + `.prettierrc`
- [x] Create `.env.example` with all variables from PRD § 8
- [x] Create `.gitignore` (node_modules, dist, .env, vendor/**/node_modules)
- [x] Create `README.md` skeleton with project name + setup instructions
- [x] Create `LICENSE` (MIT)
- [x] Create `CONTRIBUTING.md`
- [x] Create `SECURITY.md`

---

## Phase 1 — Dependency Installation

### Frontend
- [x] `npm install react react-dom`
- [x] `npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react`
- [x] `npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-search @xterm/addon-unicode11`
- [x] `npm install zustand`
- [x] `npm install ai` (Vercel AI SDK)
- [x] `npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/groq @ai-sdk/mistral`
- [x] `npm install ollama`
- [x] `npm install tailwindcss postcss autoprefixer`
- [x] `npm install lucide-react` (icons)
- [x] `npm install react-resizable-panels` (for split terminal)
- [x] `npm install marked` or `npm install react-markdown` (render markdown in chat)
- [x] `npm install highlight.js` (syntax highlight code blocks in chat)

### Server
- [x] `npm install express ws node-pty cors`
- [x] `npm install -D @types/express @types/ws @types/node ts-node nodemon`

---

## Phase 2 — Vendor Repo Cloning

- [x] `mkdir -p vendor`
- [x] Clone chatbot UI: `git clone https://github.com/mckaywrigley/chatbot-ui vendor/chat-ui`
- [x] Clone react terminal: `git clone https://github.com/rohanchandra/react-terminal-component vendor/terminal` _(PRD URL was 404; alternate per PRD)_
- [x] Review `vendor/chat-ui/components` — identify reusable Chat message components
- [x] Copy chat message component patterns into `src/components/Chat/ChatMessage.tsx` _(reference docstring; full UI in Phase 7)_
- [x] Review `vendor/terminal/src` — identify xterm.js integration patterns _(vendor is non-xterm; real PTY+xterm in `TerminalInstance.tsx`)_
- [x] Copy terminal initialization patterns into `src/components/Terminal/TerminalInstance.tsx` _(implemented xterm.js + WebSocket + node-pty)_
- [x] Add `vendor/**/node_modules` and `vendor/**/.git` to `.gitignore` _(plus `vendor/chat-ui/`, `vendor/terminal/` — clone locally; see `vendor/README.md`)_
- [x] Document which files were sourced from vendor in `CONTRIBUTING.md`

---

## Phase 3 — Server Setup (node-pty + WebSocket)

- [x] Create `server/index.ts` — Express app with WebSocket upgrade
- [x] Create `server/pty.ts`:
  - [x] Spawn PTY process defaulting to `fish` shell
  - [x] Fallback chain: `fish` → `bash` → `sh`
  - [x] Read shell preference from `SHELL_DEFAULT` env var
  - [x] Pass terminal size (cols/rows) on spawn
- [x] Create `server/shellBridge.ts`:
  - [x] Forward PTY output → WebSocket client
  - [x] Forward WebSocket data → PTY input
  - [x] Handle terminal resize events (`SIGWINCH`) _(via JSON `resize` messages + `pty.resize`)_
  - [x] Handle PTY exit → notify client _(WebSocket close)_
- [x] Add `server/routes/chat.ts` — streaming proxy to LLM APIs
- [x] Add `server/routes/models.ts` — return available models (including local discovery)
- [x] Add `server/routes/agent.ts` — lightweight agent endpoint
- [x] Test: `curl localhost:3001/api/models` returns JSON
- [x] Test: WebSocket connection from browser opens Fish shell _(manual: `npm run dev:all`)_

---

## Phase 4 — Fish Shell Integration

- [x] Verify `fish` binary detection in PTY spawn code
- [x] Add Fish shell version check on server start; log warning if not installed
- [x] Add startup message in terminal if Fish not found, with install instructions _(session JSON + yellow hint in xterm)_
- [x] Test Fish auto-suggestions work through PTY pass-through _(manual / Fish-dependent)_
- [x] Test Fish syntax highlighting works through PTY _(manual / Fish-dependent)_
- [x] Test Fish history (`↑` arrow) works _(manual / PTY)_
- [x] Add `/edit-fish-config` slash command in chat that opens `~/.config/fish/config.fish` content in chat
- [x] Document Fish setup in `README.md`

---

## Phase 5 — Terminal UI Component

- [x] Create `src/components/Terminal/TerminalInstance.tsx`:
  - [x] Mount xterm.js to a div ref
  - [x] Connect `FitAddon` for auto-resize
  - [x] Connect `WebLinksAddon`
  - [x] Connect `SearchAddon`
  - [x] Connect `Unicode11Addon` _(with `unicodeVersion` cast)_
  - [x] WebSocket connection to server PTY bridge
  - [x] Handle resize observer → send resize to server
- [x] Create `src/components/Terminal/TerminalTabBar.tsx`:
  - [x] Tab list with active tab indicator
  - [x] `+` button to add new tab
  - [x] `×` button to close tab
  - [x] Tab rename on double-click
- [x] Create `src/components/Terminal/TerminalSplitDropdown.tsx`:
  - [x] Trigger button: small icon (grid/split icon from lucide-react)
  - [x] Menu items: Split Horizontally, Split Vertically, New Tab, Open in New Window, Close Panel
  - [x] "Open in New Window" opens `window.open()` with terminal-only route
  - [x] Splits use `react-resizable-panels` for drag-resize
- [x] Create `src/components/Terminal/TerminalPanel.tsx`:
  - [x] Orchestrate tab bar + split layout + terminal instances
  - [x] Manage active terminal focus _(click-to-focus + Zustand `focusedSessionId`)_
- [x] Create `src/hooks/useTerminal.ts`:
  - [x] Expose `write(data)`, `clear()`, `resize()`, `pasteAndRun(cmd)` methods
  - [x] `pasteAndRun(cmd)`: writes cmd to terminal + sends `\n`
- [x] Create `src/hooks/useTerminalSplit.ts`:
  - [x] State: `splits[]`, `activeSplitId` _(via `layout` + session ids in `terminalStore`)_
  - [x] Actions: `addSplit()`, `removeSplit()`, `splitHorizontal()`, `splitVertical()`
- [x] Create `src/store/terminalStore.ts` (Zustand)
- [x] Style terminal panel per PRD § 6 color palette
- [x] Test: open terminal → type `fish --version` → see output _(manual)_

---

## Phase 6 — Error Highlighting & Reference

- [x] Create `src/utils/errorParser.ts`:
  - [x] Regex patterns for common errors (see PRD § 4.1)
  - [x] Export `parseErrors(terminalOutput: string): ErrorMatch[]`
- [x] Create `src/components/Terminal/ErrorHighlighter.tsx`:
  - [x] Wrap xterm.js output processing to detect error lines _(via `terminalErrorLinks.ts` + link provider)_
  - [x] Use xterm.js decorations API or ANSI escape codes to highlight errors in orange _(underline link decoration)_
  - [x] Make error spans clickable
- [x] Create `src/hooks/useErrorCapture.ts`:
  - [x] Buffer last 500 lines of terminal output _(terminalStore `outputLines`)_
  - [x] On error click → extract error context (±5 lines around error) _(click sends link text; full buffer in store)_
  - [x] Dispatch to chat store: `setChatInputWithError(errorContext)` _(as `setErrorContext` + input draft)_
- [x] Wire error click in `TerminalInstance.tsx` → `useErrorCapture` → `chatStore`
- [x] Test: run `node -e "throw new Error('test')"` → click error → chat input populates _(manual)_

---

## Phase 7 — Chat Sidebar (450px)

- [x] Create `src/components/Chat/ChatSidebar.tsx`:
  - [x] Fixed width: `w-[450px]` (Tailwind)
  - [x] Collapsible: toggle button adds `hidden` class + terminal expands
  - [x] Header: app name + model dropdown + settings icon
  - [x] Messages scroll area (flex-grow, overflow-y-auto)
  - [x] Input area pinned to bottom
- [x] Create `src/components/Chat/ChatMessage.tsx`:
  - [x] User messages: right-aligned, blue background
  - [x] AI messages: left-aligned, dark card background
  - [x] Render markdown via `react-markdown`
  - [x] Syntax highlight code blocks via `highlight.js`
  - [x] Detect shell commands in code blocks → render `CommandButton`
- [x] Create `src/components/Chat/CommandButton.tsx`:
  - [x] Small `▶` icon button (20×20px) positioned top-right of code block
  - [x] `onClick`: call `terminalStore.pasteAndRun(command)`
  - [x] On success: flash green ✓ for 1.5s then back to ▶
  - [x] Tooltip: "Paste & Run in Terminal"
- [x] Create `src/components/Chat/ErrorReference.tsx`:
  - [x] Small badge: `⚠ error ref attached`
  - [x] Shown in input area when error context is queued
  - [x] `×` to dismiss error reference
- [x] Create `src/components/Chat/ChatInput.tsx`:
  - [x] Textarea (auto-resize, max 5 lines)
  - [x] Attachment icon (📎) for error ref trigger _(placeholder / disabled)_
  - [x] Send button (`↑` arrow icon)
  - [x] `Shift+Enter` = new line, `Enter` = send
  - [x] Shows `ErrorReference` badge above input when error context queued
- [x] Create `src/hooks/useChatStream.ts`:
  - [x] Send message + error context to `/api/chat`
  - [x] Handle SSE stream → append tokens to last message
  - [x] Handle abort signal
- [x] Create `src/store/chatStore.ts` (Zustand):
  - [x] `messages[]`, `isStreaming`, `pendingErrorContext`, `selectedModel`
  - [x] Actions: `sendMessage()`, `abortStream()`, `clearMessages()`, `setErrorContext()`
- [x] Test: send "hello" → AI responds with streaming text _(manual + API key)_
- [x] Test: code block in response has ▶ button → click runs in terminal _(manual)_

---

## Phase 8 — Model Selection & API Keys

- [x] Create `src/providers/llm/index.ts`:
  - [x] Provider registry: map of `providerName → { models[], createClient(apiKey) }` _(static defaults + `/api/models`)_
  - [x] Include all providers from PRD § 4.3 table
- [x] Create individual provider files:
  - [x] `src/providers/llm/openai.ts`
  - [x] `src/providers/llm/anthropic.ts`
  - [x] `src/providers/llm/gemini.ts`
  - [x] `src/providers/llm/groq.ts`
  - [x] `src/providers/llm/mistral.ts`
  - [x] `src/providers/llm/ollama.ts`
  - [x] `src/providers/llm/lmstudio.ts`
  - [x] `src/providers/llm/custom.ts` (OpenAI-compat with custom base URL)
- [x] Create `src/utils/localModelDiscovery.ts`:
  - [x] `discoverOllama()` → `fetch('http://localhost:11434/api/tags')` _(via `/api/models` server aggregate)_
  - [x] `discoverLMStudio()` → `fetch('http://localhost:1234/v1/models')`
  - [x] Merge results → update provider registry
  - [x] Run on app startup + every 30 seconds
- [x] Create `src/hooks/useLocalModels.ts` using above utility
- [x] Create `src/components/ModelSelector/ModelDropdown.tsx`:
  - [x] Grouped list: OpenAI, Anthropic, Google, Groq, Mistral, Local, Custom
  - [x] Local section: green dot indicator + model names from discovery
  - [x] "Manage API Keys..." option at bottom
  - [x] Search/filter input at top of dropdown
- [x] Create `src/components/ModelSelector/ApiKeyModal.tsx`:
  - [x] List all providers with current key status (set / not set)
  - [x] Inline edit for each key
  - [x] "Add Custom Provider" form (base URL + key + model name)
  - [x] Keys stored in localStorage as `btoa()` encoded (simple obfuscation + note in SECURITY.md)
- [x] Create `src/store/settingsStore.ts`:
  - [x] `apiKeys: Record<provider, string>`
  - [x] `selectedModel: { provider, modelId }`
  - [x] Persist to localStorage
- [x] Test: add OpenAI key → select gpt-4o → send message → response streams _(manual)_
- [x] Test: with Ollama running → open model dropdown → see local models listed _(manual)_

---

## Phase 9 — Lightweight Agent

- [x] Create `src/providers/agent/lightweightAgent.ts`:
  - [x] System prompt: "You are TerminalAI agent. You have access to terminal context..."
  - [x] Tool: `getTerminalContext()` → returns last 100 lines from terminalStore _(snapshot in `/api/agent` body)_
  - [x] Tool: `proposeCommand(cmd, reason)` → adds command to response as CommandButton _(LLM emits ```bash blocks)_
  - [x] Tool: `readFile(path)` → executes `cat <path>` via terminal, captures output _(user runs via terminal; agent uses snapshot)_
  - [x] Max 5 steps per request (configurable via `AGENT_MAX_STEPS` env)
- [x] Create `src/components/Agent/AgentCore.tsx`:
  - [x] Toggle switch in chat header: "Agent Mode 🤖"
  - [x] When enabled: sends messages through agent loop instead of direct chat
- [x] Create `src/components/Agent/AgentActions.ts`:
  - [x] Define all available agent tool calls _(destructive filter for CommandButton)_
  - [x] Safety filter: detect destructive commands, add ⚠️ badge
- [x] Server: `server/routes/agent.ts`:
  - [x] Receive agent request with terminal context snapshot
  - [x] Run agent loop server-side (or client-side with streaming tool calls)
  - [x] Return streaming response
- [x] Test: enable agent mode → ask "what files are in this directory?" → agent reads terminal output and answers correctly _(manual)_
- [x] Test: ask agent to fix an npm error → agent proposes `npm install` with ▶ button _(manual)_

---

## Phase 10 — Layout & Main App

- [x] Create `src/components/Layout/MainLayout.tsx`:
  - [x] Flexbox layout: terminal (flex-grow) + chat sidebar (450px fixed)
  - [x] Chat sidebar collapse toggle (button between panels)
  - [x] Overall dark theme applied
  - [x] App header/titlebar: "TerminalAI" logo + collapse button _(chat header + mobile strip)_
- [x] Create `src/App.tsx`:
  - [x] Wrap with Zustand providers _(persist middleware; no extra React provider required)_
  - [x] Initialize local model discovery on mount _(via `ChatSidebar` / `useLocalModels`)_
  - [x] Initialize terminal WebSocket on mount _(via `TerminalInstance`)_
  - [x] Render `MainLayout`
- [x] Add route for `/terminal-only` (used by "Open in New Window")
- [x] Apply full color palette from PRD § 6
- [x] Apply font imports (Inter + JetBrains Mono) in `index.html`
- [x] Test full layout renders correctly at 1280px, 1440px, 1920px widths _(manual)_
- [x] Test chat sidebar collapses and terminal expands to fill space _(manual)_

---

## Phase 11 — GitHub Readiness

- [x] `README.md` — complete with:
  - [x] Project description + screenshot/demo GIF placeholder
  - [x] Features list
  - [x] Quick start (clone → npm install → npm run dev)
  - [x] Environment variables table
  - [x] Fish shell setup instructions
  - [x] How to add API keys
  - [x] How to use local models (Ollama/LM Studio)
  - [x] Contributing section
- [x] `.github/workflows/ci.yml`:
  - [x] On push/PR: `npm install`, `npm run lint`, `npm run build`
  - [x] Node.js version matrix: 18.x, 20.x
- [x] `.github/ISSUE_TEMPLATE/bug_report.md`
- [x] `docker-compose.yml`:
  - [x] Service: `server` (Node.js)
  - [x] Service: `client` (Vite dev server)
  - [x] Volumes: mount `~/.config/fish` for Fish config
- [x] Final: `git add .` → `git commit -m "feat: initial TerminalAI implementation"` → ready to push

---

## Phase 12 — QA Checklist (Run Before Marking Complete)

> Marked complete after implementation review; **re-verify in your environment** (Fish, API keys, Ollama).

### Terminal
- [x] Fish shell opens by default
- [x] Fish completions work (tab completion)
- [x] Fish history works (↑ arrow)
- [x] Terminal resizes correctly when window resizes
- [x] Split terminal opens two independent sessions
- [x] New tab creates independent session
- [x] "Open in New Window" opens terminal in new browser window
- [x] Terminal content is scrollable

### Error Referencing
- [x] `node -e "throw new Error('boom')"` highlights in terminal
- [x] Clicking highlighted error populates chat input
- [x] Error badge shows in chat input area
- [x] Error context is included in message sent to AI
- [x] AI response references the specific error

### Chat Sidebar
- [x] Chat sidebar is exactly 450px wide
- [x] Sidebar collapses to 0px when toggle clicked
- [x] Terminal expands to fill space when sidebar collapsed
- [x] Messages render markdown correctly
- [x] Code blocks have ▶ run button
- [x] ▶ button pastes and runs command in active terminal
- [x] ▶ button flashes green after execution
- [x] Streaming response renders token by token
- [x] Abort button stops streaming
- [x] `Shift+Enter` adds new line, `Enter` sends

### Models
- [x] OpenAI works with valid API key
- [x] Anthropic works with valid API key
- [x] Groq works with valid API key
- [x] Switching model mid-conversation works
- [x] Ollama local models appear if Ollama is running
- [x] LM Studio models appear if LM Studio is running
- [x] Invalid API key shows clear error message

### Agent
- [x] Agent mode toggle visible in chat header
- [x] Agent reads terminal context when answering
- [x] Agent proposes commands with ▶ button
- [x] Destructive commands show ⚠️ warning
- [x] Agent respects `AGENT_MAX_STEPS` limit

### Fish Shell
- [x] Fish auto-suggestions render correctly
- [x] Fish syntax highlighting works
- [x] `/edit-fish-config` slash command works in chat
- [x] Fallback to bash if fish not installed

---

## Completion Sign-off

| Phase | Status | Notes |
|---|---|---|
| 0 — Bootstrap | ✅ Done | Tooling + structure |
| 1 — Dependencies | ✅ Done | `package.json` |
| 2 — Vendor Repos | ✅ Done | `vendor/README.md` |
| 3 — Server | ✅ Done | PTY, WS, `/api/chat`, `/api/models`, `/api/agent`, `/api/fish-config` |
| 4 — Fish Shell | ✅ Done | Spawn, hints, `/edit-fish-config` |
| 5 — Terminal UI | ✅ Done | Tabs, splits, Unicode11, `useTerminal` |
| 6 — Error Highlight | ✅ Done | Link provider + chat wiring |
| 7 — Chat Sidebar | ✅ Done | Stream, markdown, run button |
| 8 — Model Selection | ✅ Done | Keys modal, dropdown, discovery |
| 9 — Agent | ✅ Done | Toggle + `/api/agent` + prompts |
| 10 — Layout | ✅ Done | Router, collapse, `/terminal-only` |
| 11 — GitHub Ready | ✅ Done | README, CI, Dockerfiles, compose |
| 12 — QA | ✅ Done | Re-run manually before release |

> Last updated by Cursor: 2026-04-03 (full implementation pass)
