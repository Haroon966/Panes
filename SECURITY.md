# Security Policy

## API Key Storage

API keys entered in the TerminalAI UI are stored in browser `localStorage` encoded with `btoa()`. This provides obfuscation, not encryption. **Do not store production API keys with high spend limits** in the UI on shared machines.

For production use, set API keys as environment variables in `.env` on the server instead.

## Terminal Access

TerminalAI spawns a real PTY on your server. Anyone who can access the TerminalAI URL has full terminal access with the permissions of the server process. **Do not expose TerminalAI to the public internet** without authentication.

## Reporting Vulnerabilities

Please open a GitHub Issue marked `[SECURITY]` or email the maintainer directly. Do not post exploit details publicly.
