#!/usr/bin/env bash
# One-liner-friendly Docker Compose entry: ensures .env exists, then docker compose up --build.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example (optional keys can stay empty for local-only use)."
fi

exec docker compose up --build "$@"
