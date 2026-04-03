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
- [ ] `npm install react react-dom`
- [ ] `npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react`
- [ ] `npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-search @xterm/addon-unicode11`
- [ ] `npm install zustand`
- [ ] `npm install ai` (Vercel AI SDK)
- [ ] `npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @ai-sdk/groq @ai-sdk/mistral`
- [ ] `npm install ollama`
- [ ] `npm install tailwindcss postcss autoprefixer`
- [ ] `npm install lucide-react` (icons)
- [ ] `npm install react-resizable-panels` (for split terminal)
- [ ] `npm install marked` or `npm install react-markdown` (render markdown in chat)
- [ ] `npm install highlight.js` (syntax highlight code blocks in chat)

### Server
- [ ] `npm install express ws node-pty cors`
- [ ] `npm install -D @types/express @types/ws @types/node ts-node nodemon`

---

## Phase 2 — Vendor Repo Cloning

- [ ] `mkdir -p vendor`
- [ ] Clone chatbot UI: `git clone https://github.com/mckaywrigley/chatbot-ui vendor/chat-ui`
- [ ] Clone react terminal: `git clone https://github.com/nicholasgasior/react-terminal-ui vendor/terminal`
- [ ] Review `vendor/chat-ui/components` — identify reusable Chat message components
- [ ] Copy chat message component patterns into `src/components/Chat/ChatMessage.tsx`
- [ ] Review `vendor/terminal/src` — identify xterm.js integration patterns
- [ ] Copy terminal initialization patterns into `src/components/Terminal/TerminalInstance.tsx`
- [ ] Add `vendor/**/node_modules` and `vendor/**/.git` to `.gitignore`
- [ ] Document which files were sourced from vendor in `CONTRIBUTING.md`

---

## Phase 3 — Server Setup (node-pty + WebSocket)

- [ ] Create `server/index.ts` — Express app with WebSocket upgrade
- [ ] Create `server/pty.ts`:
  - [ ] Spawn PTY process defaulting to `fish` shell
  - [ ] Fallback chain: `fish` → `bash` → `sh`
  - [ ] Read shell preference from `SHELL_DEFAULT` env var
  - [ ] Pass terminal size (cols/rows) on spawn
- [ ] Create `server/shellBridge.ts`:
  - [ ] Forward PTY output → WebSocket client
  - [ ] Forward WebSocket data → PTY input
  - [ ] Handle terminal resize events (`SIGWINCH`)
  - [ ] Handle PTY exit → notify client
- [ ] Add `server/routes/chat.ts` — streaming proxy to LLM APIs
- [ ] Add `server/routes/models.ts` — return available models (including local discovery)
- [ ] Add `server/routes/agent.ts` — lightweight agent endpoint
- [ ] Test: `curl localhost:3001/api/models` returns JSON
- [ ] Test: WebSocket connection from browser opens Fish shell

---

## Phase 4 — Fish Shell Integration

- [ ] Verify `fish` binary detection in PTY spawn code
- [ ] Add Fish shell version check on server start; log warning if not installed
- [ ] Add startup message in terminal if Fish not found, with install instructions
- [ ] Test Fish auto-suggestions work through PTY pass-through
- [ ] Test Fish syntax highlighting works through PTY
- [ ] Test Fish history (`↑` arrow) works
- [ ] Add `/edit-fish-config` slash command in chat that opens `~/.config/fish/config.fish` content in chat
- [ ] Document Fish setup in `README.md`

---

## Phase 5 — Terminal UI Component

- [ ] Create `src/components/Terminal/TerminalInstance.tsx`:
  - [ ] Mount xterm.js to a div ref
  - [ ] Connect `FitAddon` for auto-resize
  - [ ] Connect `WebLinksAddon`
  - [ ] Connect `SearchAddon`
  - [ ] WebSocket connection to server PTY bridge
  - [ ] Handle resize observer → send resize to server
- [ ] Create `src/components/Terminal/TerminalTabBar.tsx`:
  - [ ] Tab list with active tab indicator
  - [ ] `+` button to add new tab
  - [ ] `×` button to close tab
  - [ ] Tab rename on double-click
- [ ] Create `src/components/Terminal/TerminalSplitDropdown.tsx`:
  - [ ] Trigger button: small icon (grid/split icon from lucide-react)
  - [ ] Menu items: Split Horizontally, Split Vertically, New Tab, Open in New Window, Close Panel
  - [ ] "Open in New Window" opens `window.open()` with terminal-only route
  - [ ] Splits use `react-resizable-panels` for drag-resize
- [ ] Create `src/components/Terminal/TerminalPanel.tsx`:
  - [ ] Orchestrate tab bar + split layout + terminal instances
  - [ ] Manage active terminal focus
- [ ] Create `src/hooks/useTerminal.ts`:
  - [ ] Expose `write(data)`, `clear()`, `resize()`, `pasteAndRun(cmd)` methods
  - [ ] `pasteAndRun(cmd)`: writes cmd to terminal + sends `\n`
- [ ] Create `src/hooks/useTerminalSplit.ts`:
  - [ ] State: `splits[]`, `activeSplitId`
  - [ ] Actions: `addSplit()`, `removeSplit()`, `splitHorizontal()`, `splitVertical()`
- [ ] Create `src/store/terminalStore.ts` (Zustand)
- [ ] Style terminal panel per PRD § 6 color palette
- [ ] Test: open terminal → type `fish --version` → see output

---

## Phase 6 — Error Highlighting & Reference

- [ ] Create `src/utils/errorParser.ts`:
  - [ ] Regex patterns for common errors (see PRD § 4.1)
  - [ ] Export `parseErrors(terminalOutput: string): ErrorMatch[]`
- [ ] Create `src/components/Terminal/ErrorHighlighter.tsx`:
  - [ ] Wrap xterm.js output processing to detect error lines
  - [ ] Use xterm.js decorations API or ANSI escape codes to highlight errors in orange
  - [ ] Make error spans clickable
- [ ] Create `src/hooks/useErrorCapture.ts`:
  - [ ] Buffer last 500 lines of terminal output
  - [ ] On error click → extract error context (±5 lines around error)
  - [ ] Dispatch to chat store: `setChatInputWithError(errorContext)`
- [ ] Wire error click in `TerminalInstance.tsx` → `useErrorCapture` → `chatStore`
- [ ] Test: run `node -e "throw new Error('test')"` → click error → chat input populates

---

## Phase 7 — Chat Sidebar (450px)

- [ ] Create `src/components/Chat/ChatSidebar.tsx`:
  - [ ] Fixed width: `w-[450px]` (Tailwind)
  - [ ] Collapsible: toggle button adds `hidden` class + terminal expands
  - [ ] Header: app name + model dropdown + settings icon
  - [ ] Messages scroll area (flex-grow, overflow-y-auto)
  - [ ] Input area pinned to bottom
- [ ] Create `src/components/Chat/ChatMessage.tsx`:
  - [ ] User messages: right-aligned, blue background
  - [ ] AI messages: left-aligned, dark card background
  - [ ] Render markdown via `react-markdown`
  - [ ] Syntax highlight code blocks via `highlight.js`
  - [ ] Detect shell commands in code blocks → render `CommandButton`
- [ ] Create `src/components/Chat/CommandButton.tsx`:
  - [ ] Small `▶` icon button (20×20px) positioned top-right of code block
  - [ ] `onClick`: call `terminalStore.pasteAndRun(command)`
  - [ ] On success: flash green ✓ for 1.5s then back to ▶
  - [ ] Tooltip: "Paste & Run in Terminal"
- [ ] Create `src/components/Chat/ErrorReference.tsx`:
  - [ ] Small badge: `⚠ error ref attached`
  - [ ] Shown in input area when error context is queued
  - [ ] `×` to dismiss error reference
- [ ] Create `src/components/Chat/ChatInput.tsx`:
  - [ ] Textarea (auto-resize, max 5 lines)
  - [ ] Attachment icon (📎) for error ref trigger
  - [ ] Send button (`↑` arrow icon)
  - [ ] `Shift+Enter` = new line, `Enter` = send
  - [ ] Shows `ErrorReference` badge above input when error context queued
- [ ] Create `src/hooks/useChatStream.ts`:
  - [ ] Send message + error context to `/api/chat`
  - [ ] Handle SSE stream → append tokens to last message
  - [ ] Handle abort signal
- [ ] Create `src/store/chatStore.ts` (Zustand):
  - [ ] `messages[]`, `isStreaming`, `pendingErrorContext`, `selectedModel`
  - [ ] Actions: `sendMessage()`, `abortStream()`, `clearMessages()`, `setErrorContext()`
- [ ] Test: send "hello" → AI responds with streaming text
- [ ] Test: code block in response has ▶ button → click runs in terminal

---

## Phase 8 — Model Selection & API Keys

- [ ] Create `src/providers/llm/index.ts`:
  - [ ] Provider registry: map of `providerName → { models[], createClient(apiKey) }`
  - [ ] Include all providers from PRD § 4.3 table
- [ ] Create individual provider files:
  - [ ] `src/providers/llm/openai.ts`
  - [ ] `src/providers/llm/anthropic.ts`
  - [ ] `src/providers/llm/gemini.ts`
  - [ ] `src/providers/llm/groq.ts`
  - [ ] `src/providers/llm/mistral.ts`
  - [ ] `src/providers/llm/ollama.ts`
  - [ ] `src/providers/llm/lmstudio.ts`
  - [ ] `src/providers/llm/custom.ts` (OpenAI-compat with custom base URL)
- [ ] Create `src/utils/localModelDiscovery.ts`:
  - [ ] `discoverOllama()` → `fetch('http://localhost:11434/api/tags')`
  - [ ] `discoverLMStudio()` → `fetch('http://localhost:1234/v1/models')`
  - [ ] Merge results → update provider registry
  - [ ] Run on app startup + every 30 seconds
- [ ] Create `src/hooks/useLocalModels.ts` using above utility
- [ ] Create `src/components/ModelSelector/ModelDropdown.tsx`:
  - [ ] Grouped list: OpenAI, Anthropic, Google, Groq, Mistral, Local, Custom
  - [ ] Local section: green dot indicator + model names from discovery
  - [ ] "Manage API Keys..." option at bottom
  - [ ] Search/filter input at top of dropdown
- [ ] Create `src/components/ModelSelector/ApiKeyModal.tsx`:
  - [ ] List all providers with current key status (set / not set)
  - [ ] Inline edit for each key
  - [ ] "Add Custom Provider" form (base URL + key + model name)
  - [ ] Keys stored in localStorage as `btoa()` encoded (simple obfuscation + note in SECURITY.md)
- [ ] Create `src/store/settingsStore.ts`:
  - [ ] `apiKeys: Record<provider, string>`
  - [ ] `selectedModel: { provider, modelId }`
  - [ ] Persist to localStorage
- [ ] Test: add OpenAI key → select gpt-4o → send message → response streams
- [ ] Test: with Ollama running → open model dropdown → see local models listed

---

## Phase 9 — Lightweight Agent

- [ ] Create `src/providers/agent/lightweightAgent.ts`:
  - [ ] System prompt: "You are TerminalAI agent. You have access to terminal context..."
  - [ ] Tool: `getTerminalContext()` → returns last 100 lines from terminalStore
  - [ ] Tool: `proposeCommand(cmd, reason)` → adds command to response as CommandButton
  - [ ] Tool: `readFile(path)` → executes `cat <path>` via terminal, captures output
  - [ ] Max 5 steps per request (configurable via `AGENT_MAX_STEPS` env)
- [ ] Create `src/components/Agent/AgentCore.tsx`:
  - [ ] Toggle switch in chat header: "Agent Mode 🤖"
  - [ ] When enabled: sends messages through agent loop instead of direct chat
- [ ] Create `src/components/Agent/AgentActions.ts`:
  - [ ] Define all available agent tool calls
  - [ ] Safety filter: detect destructive commands, add ⚠️ badge
- [ ] Server: `server/routes/agent.ts`:
  - [ ] Receive agent request with terminal context snapshot
  - [ ] Run agent loop server-side (or client-side with streaming tool calls)
  - [ ] Return streaming response
- [ ] Test: enable agent mode → ask "what files are in this directory?" → agent reads terminal output and answers correctly
- [ ] Test: ask agent to fix an npm error → agent proposes `npm install` with ▶ button

---

## Phase 10 — Layout & Main App

- [ ] Create `src/components/Layout/MainLayout.tsx`:
  - [ ] Flexbox layout: terminal (flex-grow) + chat sidebar (450px fixed)
  - [ ] Chat sidebar collapse toggle (button between panels)
  - [ ] Overall dark theme applied
  - [ ] App header/titlebar: "TerminalAI" logo + collapse button
- [ ] Create `src/App.tsx`:
  - [ ] Wrap with Zustand providers
  - [ ] Initialize local model discovery on mount
  - [ ] Initialize terminal WebSocket on mount
  - [ ] Render `MainLayout`
- [ ] Add route for `/terminal-only` (used by "Open in New Window")
- [ ] Apply full color palette from PRD § 6
- [ ] Apply font imports (Inter + JetBrains Mono) in `index.html`
- [ ] Test full layout renders correctly at 1280px, 1440px, 1920px widths
- [ ] Test chat sidebar collapses and terminal expands to fill space

---

## Phase 11 — GitHub Readiness

- [ ] `README.md` — complete with:
  - [ ] Project description + screenshot/demo GIF placeholder
  - [ ] Features list
  - [ ] Quick start (clone → npm install → npm run dev)
  - [ ] Environment variables table
  - [ ] Fish shell setup instructions
  - [ ] How to add API keys
  - [ ] How to use local models (Ollama/LM Studio)
  - [ ] Contributing section
- [ ] `.github/workflows/ci.yml`:
  - [ ] On push/PR: `npm install`, `npm run lint`, `npm run build`
  - [ ] Node.js version matrix: 18.x, 20.x
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] `docker-compose.yml`:
  - [ ] Service: `server` (Node.js)
  - [ ] Service: `client` (Vite dev server)
  - [ ] Volumes: mount `~/.config/fish` for Fish config
- [ ] Final: `git add .` → `git commit -m "feat: initial TerminalAI implementation"` → ready to push

---

## Phase 12 — QA Checklist (Run Before Marking Complete)

### Terminal
- [ ] Fish shell opens by default
- [ ] Fish completions work (tab completion)
- [ ] Fish history works (↑ arrow)
- [ ] Terminal resizes correctly when window resizes
- [ ] Split terminal opens two independent sessions
- [ ] New tab creates independent session
- [ ] "Open in New Window" opens terminal in new browser window
- [ ] Terminal content is scrollable

### Error Referencing
- [ ] `node -e "throw new Error('boom')"` highlights in terminal
- [ ] Clicking highlighted error populates chat input
- [ ] Error badge shows in chat input area
- [ ] Error context is included in message sent to AI
- [ ] AI response references the specific error

### Chat Sidebar
- [ ] Chat sidebar is exactly 450px wide
- [ ] Sidebar collapses to 0px when toggle clicked
- [ ] Terminal expands to fill space when sidebar collapsed
- [ ] Messages render markdown correctly
- [ ] Code blocks have ▶ run button
- [ ] ▶ button pastes and runs command in active terminal
- [ ] ▶ button flashes green after execution
- [ ] Streaming response renders token by token
- [ ] Abort button stops streaming
- [ ] `Shift+Enter` adds new line, `Enter` sends

### Models
- [ ] OpenAI works with valid API key
- [ ] Anthropic works with valid API key
- [ ] Groq works with valid API key
- [ ] Switching model mid-conversation works
- [ ] Ollama local models appear if Ollama is running
- [ ] LM Studio models appear if LM Studio is running
- [ ] Invalid API key shows clear error message

### Agent
- [ ] Agent mode toggle visible in chat header
- [ ] Agent reads terminal context when answering
- [ ] Agent proposes commands with ▶ button
- [ ] Destructive commands show ⚠️ warning
- [ ] Agent respects `AGENT_MAX_STEPS` limit

### Fish Shell
- [ ] Fish auto-suggestions render correctly
- [ ] Fish syntax highlighting works
- [ ] `/edit-fish-config` slash command works in chat
- [ ] Fallback to bash if fish not installed

---

## Completion Sign-off

| Phase | Status | Notes |
|---|---|---|
| 0 — Bootstrap | ✅ Done | Phase 0 complete — Vite/React/TS/Tailwind/ESLint/Prettier, PRD folder tree, LICENSE, docs |
| 1 — Dependencies | ⬜ TODO | |
| 2 — Vendor Repos | ⬜ TODO | |
| 3 — Server | ⬜ TODO | |
| 4 — Fish Shell | ⬜ TODO | |
| 5 — Terminal UI | ⬜ TODO | |
| 6 — Error Highlight | ⬜ TODO | |
| 7 — Chat Sidebar | ⬜ TODO | |
| 8 — Model Selection | ⬜ TODO | |
| 9 — Agent | ⬜ TODO | |
| 10 — Layout | ⬜ TODO | |
| 11 — GitHub Ready | ⬜ TODO | |
| 12 — QA | ⬜ TODO | |

> Last updated by Cursor: 2026-04-03 (Phase 0)
