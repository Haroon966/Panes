# TerminalAI 🖥️🤖

> A terminal + AI chat panel — click an error, get a fix, run it with one button. Runs as a **desktop app** by default (Electron); you can still use the browser for development.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

![Screenshot placeholder](https://via.placeholder.com/800x420/0d1117/8b949e?text=TerminalAI+screenshot+or+GIF)

Replace **`YOUR_GITHUB_USERNAME`** in clone / install commands below with your GitHub user or organization once the repo is published (or use your fork URL).

---

## Features

- **Fish shell terminal** — real PTY via node-pty, Fish by default
- **AI chat sidebar** — 450px panel, collapsible
- **Click-to-reference errors** — click any terminal error to send it to AI
- **One-click command execution** — AI gives a command, click ▶ to run it instantly
- **Terminal splitting** — split horizontal/vertical, new tab, new window
- **Multi-provider AI** — OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama, LM Studio
- **Auto-discover local models** — Ollama and LM Studio models appear automatically
- **Lightweight agent** — reads terminal context, proposes commands, takes actions with your approval

---

## Host on GitHub

1. Create a new repository on GitHub (for example **terminalai**).
2. From this project directory:

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/terminalai.git
git branch -M main
git push -u origin main
```

With [GitHub CLI](https://cli.github.com/): `gh repo create terminalai --public --source=. --remote=origin --push`

Enable **Actions** so CI and releases run. Optional: branch protection on `main`, required status checks.

---

## Quick Start

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/terminalai.git
cd terminalai
./scripts/install.sh
# Edit .env if you use cloud API keys (optional for local Ollama/LM Studio)
npm start
```

**One-liner** (clone + install; pass your repo URL as the first argument):

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/terminalai/main/scripts/install.sh | bash -s -- https://github.com/YOUR_GITHUB_USERNAME/terminalai.git
```

After install, use **`npm start`** (Electron) or **`npm run dev:web`** (browser).

Manual path (same result as `./scripts/install.sh`):

```bash
npm ci   # or npm install
cp .env.example .env   # if .env does not exist yet
```

Optional — reference sources for chat/terminal UI (see CHECKLIST Phase 2): follow [vendor/README.md](vendor/README.md).

- **`npm start`** (alias **`npm run app`**) starts the API, Vite, and opens the **Electron** window (no browser tab needed). Waits for `http://localhost:3001` and `http://localhost:5173` before launching.
- **Linux + Electron:** If you see `The SUID sandbox helper binary was found, but is not configured correctly`, the app already passes **`--no-sandbox`** on Linux by default. To use Chromium’s sandbox instead, fix `node_modules/electron/dist/chrome-sandbox` (owned by root, mode `4755`, see [Electron sandbox docs](https://www.electronjs.org/docs/latest/tutorial/sandbox)) and run with **`ELECTRON_USE_SANDBOX=1`**.
- **Browser-only dev:** `npm run dev:web` (same as `npm run dev:all`) — Vite + API; open [http://localhost:5173](http://localhost:5173).
- **API only:** `npm run dev:server` — [http://localhost:3001](http://localhost:3001).

### Desktop vs browser

The API server (`node-pty`, `better-sqlite3`) runs as a **child `node` process**, not inside Electron’s renderer. You do **not** need `@electron/rebuild` for normal use. Run `npm run rebuild:electron` only if you change the app so native addons load from **Electron’s main process** (unusual for this repo).

### Production-style desktop run

Builds the UI and a bundled API entrypoint, then opens Electron (API + static UI on one port):

```bash
npm run start:prod
```

Uses `NODE_ENV=production`; Express serves `dist/` from the same port as `/api` and `/ws` (default **3001**).

### Packaged installers

```bash
npm run build:app
```

Artifacts land in `release/` (e.g. AppImage/deb on Linux, NSIS on Windows, DMG on macOS). The packaged app still expects **`node` on `PATH`** to spawn the API bundle (`dist-server/index.cjs`). Install **Node 20+** on the machine where you run the AppImage or `.deb`, or the API process will not start.

**Note:** `npm run rebuild:electron` pulls tooling that declares **Node ≥22.12**; use Node 22 LTS for that script if you hit engine warnings.

### GitHub Releases (Linux)

Pushing a version tag builds Linux **AppImage** and **deb** in GitHub Actions and attaches them to a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

You can also run the **Release** workflow manually from the Actions tab (build only; artifacts upload when the run is for a `v*` tag). Windows/macOS installers are not produced by that workflow yet; build them locally with `npm run build:app` on each platform if needed.

### Browser-only production preview

```bash
npm run build
npm run build:server
NODE_ENV=production node dist-server/index.cjs
# Open http://localhost:3001 (UI + API same origin)
```

---

## Docker Compose

`.env` is optional: Compose loads it when present. To bootstrap `.env` from `.env.example` and start everything:

```bash
./scripts/docker-up.sh
```

Or without the helper:

```bash
docker compose up --build
```

- API: `http://localhost:3001`
- Vite dev client: `http://localhost:5173`  
  Mounts `~/.config/fish` read-only into the server container for Fish config, and a named volume `terminalai-data` at `/root/.config/terminalai` for SQLite persistence (see [docker-compose.yml](docker-compose.yml)).

---

## Environment Variables

See `.env.example` for all options. Key ones:

| Variable | Description | Default |
|---|---|---|
| `SHELL_DEFAULT` | Default shell to spawn | `fish` |
| `PORT` | Server port | `3001` |
| `OPENAI_API_KEY` | Optional server-side OpenAI key | — |
| `ANTHROPIC_API_KEY` | Optional server-side Anthropic key | — |
| `GOOGLE_API_KEY` | Optional server-side Google key | — |
| `GROQ_API_KEY` | Optional server-side Groq key | — |
| `MISTRAL_API_KEY` | Optional server-side Mistral key | — |
| `OLLAMA_BASE_URL` | Ollama local endpoint | `http://localhost:11434` |
| `LMSTUDIO_BASE_URL` | LM Studio local endpoint | `http://localhost:1234` |
| `ENABLE_AGENT` | Enable agent endpoint | `true` |
| `AGENT_MAX_STEPS` | Max agent steps | `5` |
| `TERMINALAI_DATA_DIR` | Directory for SQLite file (`terminalai.db`) | `~/.config/terminalai` |
| `TERMINALAI_DB_PATH` | Full path to SQLite file (overrides data dir) | — |

**Persistence:** The API server stores chat history, terminal tab layout, and non-secret settings (provider, model, agent mode) in SQLite. API keys and custom base URLs remain in the browser (`localStorage`). `GET /api/health` includes `"db": true` when the database is reachable.

Inspect the DB locally:

```bash
sqlite3 ~/.config/terminalai/terminalai.db ".tables"
```

You can also add API keys in the UI via ⚙ → Manage API Keys.

---

## Cline agent (HTTP integration)

TerminalAI can drive chat through an **OpenAI-compatible** upstream (same shape as Cline’s local stack: typically Ollama or LM Studio at `/v1/chat/completions`). This is **not** the VS Code Cline extension; it is a first-class HTTP path in this app, with upstream [Cline](https://github.com/cline/cline) used as **reference** (see [NOTICE](NOTICE) and `vendor/cline`).

**API (server):**

- `GET /api/agent/cline/options` — base URL resolution, `upstreamKind`, suggested model hints
- `GET /api/agent/cline/models` — list models from the resolved upstream (optional `?clineLocalBaseUrl=`)
- `GET /api/agent/cline/health` — quick readiness check
- `POST /api/agent/cline` — non-streaming proxy; body may include `clineModel` for the dedicated Cline model when the UI model is a cloud id

**Environment:** See `.env.example` (`CLINE_LOCAL_BASE_URL`, `CLINE_DEFAULT_MODEL`, `CLINE_CHAT_PATH`, `OLLAMA_BASE_URL`, `LMSTUDIO_BASE_URL`, etc.). If `CLINE_LOCAL_BASE_URL` is unset, the server falls back to `OLLAMA_BASE_URL` then `LMSTUDIO_BASE_URL`.

**UI:** Choose **Cline** as the agent backend in chat settings. Pick a **Cline model** from the dropdown (from `/api/agent/cline/models`). **Auto-switch to LangChain on error** is configurable in Manage API Keys.

**Persistence:** `agent_backend` and `cline_model` can be stored in SQLite app prefs (see `server/db/migrations/`).

**Docker / Ollama on the host:** From inside a container, `localhost` is the container itself. Point Ollama with e.g. `OLLAMA_BASE_URL=http://host.docker.internal:11434` (or your LAN IP) so the API can reach the host.

**Reference submodule:** `git submodule update --init vendor/cline` (pinned tag). Details in [vendor/README.md](vendor/README.md). Architecture notes: [docs/cline-architecture-audit.md](docs/cline-architecture-audit.md), capability matrix: [docs/cline-capability-matrix.md](docs/cline-capability-matrix.md).

**Tests:** `npm run test:cline-resolve` (URL/kind/model resolution helpers).

---

## Using Local Models

**Ollama:**
```bash
ollama serve
ollama pull llama3.2
```
Models appear automatically in the model dropdown under "Local."

**LM Studio:**
Start LM Studio and enable the local server. Models appear under "Local."

---

## Fish Shell Setup

TerminalAI uses Fish as the default shell. Install it:

```bash
# macOS
brew install fish

# Ubuntu/Debian
sudo apt install fish

# Arch
sudo pacman -S fish
```

Use `/edit-fish-config` in the chat to view/edit your Fish config.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To add a new LLM provider, add a file to `src/providers/llm/` and register it in `src/providers/llm/index.ts`.

---

## License

MIT — see [LICENSE](LICENSE)
