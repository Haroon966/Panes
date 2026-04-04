#!/usr/bin/env bash
# Bootstrap or refresh dependencies for TerminalAI.
# From repo root: ./scripts/install.sh
# Fresh clone via curl: curl -fsSL URL | bash -s -- https://github.com/OWNER/terminalai.git [dirname]

set -euo pipefail

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "error: Node.js is required (>= 20). Install from https://nodejs.org/" >&2
    exit 1
  fi
  local major
  major="$(node -p "parseInt(process.versions.node, 10)")"
  if [ "$major" -lt 20 ]; then
    echo "error: Node.js 20+ required (found $(node -v))" >&2
    exit 1
  fi
}

is_repo_root() {
  [ -f package.json ] && grep -q '"name"[[:space:]]*:[[:space:]]*"terminalai"' package.json
}

ROOT_DIR=""
if is_repo_root; then
  ROOT_DIR=$(pwd)
elif [ -n "${1:-}" ]; then
  CLONE_URL=$1
  CLONE_DIR=${2:-terminalai}
  if [ -e "$CLONE_DIR" ]; then
    echo "error: directory '$CLONE_DIR' already exists; remove it or choose another name" >&2
    exit 1
  fi
  if ! command -v git >/dev/null 2>&1; then
    echo "error: git is required to clone the repository" >&2
    exit 1
  fi
  git clone "$CLONE_URL" "$CLONE_DIR"
  cd "$CLONE_DIR"
  ROOT_DIR=$(pwd)
else
  echo "usage:" >&2
  echo "  from clone:  ./scripts/install.sh" >&2
  echo "  fresh clone: curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install.sh | bash -s -- https://github.com/OWNER/terminalai.git [dirname]" >&2
  exit 1
fi

cd "$ROOT_DIR"
need_node

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example — add API keys if you use cloud models."
fi

echo ""
echo "Install finished."
echo "  Electron (default):  npm start"
echo "  Browser dev:         npm run dev:web"
