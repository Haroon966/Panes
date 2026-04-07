import path from 'node:path';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';
import { agentReadOnlyMode, enforceReadBeforeWrite } from './approvalEnv';

/** Stable workspace-relative key for read-before-write tracking (forward slashes). */
export function canonicalReadBeforeWriteKey(rootAbs: string, relative_path: string): string {
  const root = path.resolve(rootAbs);
  try {
    const abs = resolveWorkspaceFileAbs(root, relative_path);
    return path.relative(root, abs).split(path.sep).join('/') || '.';
  } catch {
    return relative_path.trim().replace(/\\/g, '/').replace(/^\/+/, '') || '.';
  }
}

export function registerPathReadForWriteGuard(
  tracker: Set<string> | undefined,
  rootAbs: string,
  relative_path: string
): void {
  if (!tracker || !enforceReadBeforeWrite() || agentReadOnlyMode()) return;
  tracker.add(canonicalReadBeforeWriteKey(rootAbs, relative_path));
}

/** @returns Refusal message, or null if allowed */
export function readBeforeWriteBlockedMessage(
  tracker: Set<string> | undefined,
  rootAbs: string,
  relative_path: string,
  verb: string
): string | null {
  if (!enforceReadBeforeWrite() || !tracker || agentReadOnlyMode()) return null;
  const k = canonicalReadBeforeWriteKey(rootAbs, relative_path);
  if (tracker.has(k)) return null;
  return `Refused: AGENT_ENFORCE_READ_BEFORE_WRITE is enabled — call read_workspace_file or get_workspace_file_outline on "${k}" in this turn before ${verb}.`;
}
