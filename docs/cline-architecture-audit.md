# Cline upstream architecture audit (TerminalAI)

**Local reference:** Optionally clone upstream into `vendor/cline` (see [vendor/README.md](../vendor/README.md)); the path is gitignored and not shipped with the repo.  
**Upstream:** https://github.com/cline/cline — Apache-2.0.

## Entrypoints

| Area | Path | Role |
|------|------|------|
| VS Code extension | `src/extension.ts` | Activation, commands, webview host |
| Webview UI | `webview-ui/` | React app inside the extension |
| CLI | `cli/` | Headless / alternate entry (see `cli/package.json`, `cli/src/index.ts`) |
| Proto | `proto/` | gRPC definitions (used for host ↔ UI / services in upstream) |
| Standalone | `src/standalone/`, `standalone/` | VS Code context shims for non-IDE builds |

## `vscode` API coupling

Roughly **70+ TypeScript files** under a local `vendor/cline` checkout import `vscode` (extension host,
`hosts/vscode/hostbridge/*`, webview providers, tests). The bulk of agent UX and
workspace integration is **not** portable to a browser + Express app without
reimplementing those APIs.

**Portable study targets:** tool handler patterns under `src/core/task/tools/`,
message types in `src/shared/`, and UI affordances in `webview-ui` (as **design
reference only**, not copied source).

## Proto / gRPC as integration boundary

Upstream exposes gRPC clients in webview (`webview-ui/src/services/grpc-client-base.ts`
and related). A **future sidecar** integration would likely:

1. Run a small Node process that speaks the same protos, **or**
2. Use upstream’s CLI if it exposes a stable local socket — **requires per-version
   verification** inside your `vendor/cline` clone.

This is **not** wired in TerminalAI today; the production path is OpenAI-compatible
HTTP (`/api/agent/cline`).

## Recommendation

Keep an optional **read-only** clone at `vendor/cline` for diffs and docs. Implement
Cline-like behavior in TerminalAI’s own `server/agent/` and React UI.
