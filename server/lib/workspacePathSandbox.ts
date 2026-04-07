import path from 'node:path';

/**
 * Resolve a workspace-relative path to an absolute path under `rootAbs`.
 * Rejects path traversal outside the workspace (same rules as agent file tools).
 */
export function resolveWorkspaceFileAbs(rootAbs: string, relativePath: string): string {
  const trimmed = relativePath.trim() || '.';
  const normalized = path.normalize(trimmed).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.resolve(rootAbs, normalized);
  const rootResolved = path.resolve(rootAbs);
  const relCheck = path.relative(rootResolved, abs);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    throw new Error('Path escapes workspace root');
  }
  return abs;
}
