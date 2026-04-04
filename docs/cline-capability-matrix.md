# Cline-like capability matrix (TerminalAI vs upstream)

| Capability | Upstream Cline (extension) | TerminalAI today | Target / notes |
|------------|----------------------------|----------------|----------------|
| Chat + streaming | Webview + core task loop | LangGraph `/api/agent` + Cline HTTP `/api/agent/cline` | Keep both backends |
| OpenAI-compatible local models | Yes (Ollama, LM Studio, etc.) | Cline proxy + env fallbacks | Phase 1: dedicated Cline model UI |
| Multi-step agent with tools | Yes (rich toolkit) | LangGraph + workspace + optional shell tool | Stream shows tool start/end + truncated output |
| Human approve before run | Yes (per tool / command) | `AGENT_REQUIRE_APPROVAL_FOR_WRITES` / shell approval | Approve / Reject in chat + `/api/agent/hitl/*` |
| Edit files in workspace | Yes (diff view) | read / write / search_replace tools | Writes can require approval |
| Run terminal commands | Yes (VS Code terminal) | PTY + suggest/run + optional `run_workspace_command` | Shell gated by `AGENT_ALLOW_SHELL` + allowlist |
| Browser automation | Yes | No | Out of scope for web MVP |
| MCP tools | Yes | No | Optional later |
| SQLite prefs sync | N/A | Provider/model | Add `agent_backend`, `cline_model` |

**Non-goals (current plan):** embedding the upstream webview bundle; copying all of `vendor/cline/src` into `src/`.
