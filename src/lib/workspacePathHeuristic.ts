/**
 * Heuristic for assistant `inline code` spans that are probably workspace-relative paths.
 * False positives/negatives are acceptable; server still validates on open.
 */
export function isLikelyWorkspaceRelativePath(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 512) return false;
  if (/[\s\n\r]/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (t.startsWith('//')) return false;
  if (t.includes('://')) return false;
  // Allow common path characters (including leading dot for .env)
  if (!/^[a-zA-Z0-9_.@/-]+$/.test(t)) return false;
  const parts = t.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  const last = parts[parts.length - 1] ?? '';
  if (!last.includes('.')) return false;
  if (last === '.' || last === '..') return false;
  // Avoid pure semver-looking tokens as paths
  if (parts.length === 1 && /^\d+\.\d+/.test(last)) return false;
  return true;
}

/**
 * Parses `path:line` or `path#L42` / `path#42` when the path part looks like a workspace-relative file.
 * Used for assistant inline code → open editor at line (not live “agent cursor” decorations).
 */
export function parseWorkspacePathWithLine(raw: string): { path: string; line: number } | null {
  const t = raw.trim();
  if (t.length < 3 || t.length > 520) return null;

  const hashLine = /^(.+?)#L?(\d{1,7})$/i.exec(t);
  if (hashLine) {
    const pathPart = hashLine[1]!.trim();
    const line = parseInt(hashLine[2]!, 10);
    if (line >= 1 && isLikelyWorkspaceRelativePath(pathPart)) {
      return { path: pathPart, line };
    }
  }

  const colon = /^(.+):(\d{1,7})$/;
  const m = colon.exec(t);
  if (m) {
    const pathPart = m[1]!.trim();
    const line = parseInt(m[2]!, 10);
    if (line >= 1 && isLikelyWorkspaceRelativePath(pathPart)) {
      return { path: pathPart, line };
    }
  }
  return null;
}
