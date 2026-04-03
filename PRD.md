# 🖥️ TerminalAI — Product Requirements Document

> **Version:** 1.0.0  
> **Date:** 2026-04-03  
> **Status:** Ready for Cursor Implementation  
> **Cursor Instruction:** Read this PRD + `CHECKLIST.md` before writing a single line of code. Clone repos listed here, copy relevant files, then build on top of them.

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
- Chat sidebar: fixed 450px, collapsible via toggle button
- Terminal: fills remaining width
- Minimum total width: 900px
- Below 900px: chat becomes a slide-over drawer

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

---

## 10. Success Criteria

- [ ] Terminal opens with Fish shell by default in < 1 second
- [ ] User can click an error → chat auto-populates → AI responds with command → user clicks ▶ → command runs
- [ ] Model can be switched mid-conversation without losing context
- [ ] Ollama local models appear automatically in model list if Ollama is running
- [ ] Terminal can be split, opened in new tab, and opened in new window
- [ ] Chat sidebar is exactly 450px wide and collapsible
