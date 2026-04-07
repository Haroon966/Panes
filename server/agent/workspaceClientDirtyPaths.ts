import { canonicalReadBeforeWriteKey } from './workspaceReadBeforeWrite';

const MAX_DIRTY_PATHS = 64;
const MAX_PATH_CHARS = 4096;

/** Normalize client-supplied dirty paths for one agent request. */
export function sanitizeClientWorkspaceDirtyPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw.slice(0, MAX_DIRTY_PATHS)) {
    if (typeof x !== 'string') continue;
    const t = x.trim().replace(/\\/g, '/').slice(0, MAX_PATH_CHARS);
    if (t) out.push(t);
  }
  return out;
}

export function buildClientWorkspaceDirtyPathSet(rootAbs: string, paths: string[]): Set<string> {
  const s = new Set<string>();
  for (const p of paths) {
    s.add(canonicalReadBeforeWriteKey(rootAbs, p));
  }
  return s;
}

/** @returns Refusal message, or null if path is not in the client dirty set */
export function clientWorkspaceDirtyBlockedMessage(
  dirty: Set<string> | undefined,
  rootAbs: string,
  relative_path: string,
  verb: string
): string | null {
  if (!dirty || dirty.size === 0) return null;
  const k = canonicalReadBeforeWriteKey(rootAbs, relative_path);
  if (!dirty.has(k)) return null;
  return `Refused: the workspace editor has unsaved changes for "${k}". Ask the user to save or discard edits in the editor before ${verb}.`;
}
