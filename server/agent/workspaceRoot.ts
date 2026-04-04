import path from 'node:path';
import { getPtyCwdForSession } from './ptyCwd';

/** Apply AGENT_WORKSPACE_ALLOWLIST clamping to an absolute path. */
export function applyWorkspaceAllowlist(absInput: string): string {
  const abs = path.resolve(absInput);
  const allow = process.env.AGENT_WORKSPACE_ALLOWLIST?.trim();
  if (allow) {
    const allowedAbs = path.resolve(allow);
    if (!abs.startsWith(allowedAbs + path.sep) && abs !== allowedAbs) {
      console.warn(
        '[TerminalAI] workspace root outside AGENT_WORKSPACE_ALLOWLIST; using allowlist root'
      );
      return allowedAbs;
    }
  }
  return abs;
}

/**
 * Absolute workspace root for agent file tools when no live terminal cwd applies.
 * Client hint → AGENT_WORKSPACE_ROOT → API process cwd, then allowlist.
 */
export function resolveAgentWorkspaceRoot(clientHint?: string): string {
  return resolveWorkspaceRootWhenShellDisconnected(clientHint);
}

/**
 * Fallback workspace root when the integrated shell is unavailable: WebSocket disconnected,
 * session not registered, non-Linux host, or /proc cwd cannot be read. Does not consult PTY.
 * Client hint → AGENT_WORKSPACE_ROOT → API process cwd, then allowlist.
 */
export function resolveWorkspaceRootWhenShellDisconnected(workspaceRootHint?: string): string {
  const envRoot = process.env.AGENT_WORKSPACE_ROOT?.trim();
  const hint = workspaceRootHint?.trim();
  const fallback = process.cwd();
  const candidate = hint || envRoot || fallback;
  return applyWorkspaceAllowlist(path.resolve(candidate));
}

/**
 * Workspace root for one agent request. When a terminal tab is connected, the PTY's
 * current directory wins over the client hint (see plan: terminal cwd overrides settings).
 */
export function resolveEffectiveWorkspaceRoot(options: {
  workspaceRootHint?: string;
  terminalSessionId?: string;
}): string {
  const sid = options.terminalSessionId?.trim();
  if (sid) {
    const fromPty = getPtyCwdForSession(sid);
    if (fromPty) {
      return applyWorkspaceAllowlist(path.resolve(fromPty));
    }
  }
  return resolveWorkspaceRootWhenShellDisconnected(options.workspaceRootHint);
}
