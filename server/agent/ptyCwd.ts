import fs from 'node:fs';
import { getPtySession } from '../ptySessionRegistry';

/**
 * Best-effort cwd of the shell behind a browser terminal tab (registered PTY).
 * Linux: /proc/<pid>/cwd. Other platforms: not implemented (returns null).
 */
export function getPtyCwdForSession(sessionId: string): string | null {
  const sid = sessionId?.trim();
  if (!sid) return null;
  const entry = getPtySession(sid);
  if (!entry) return null;
  const pid = entry.pty.pid;
  if (typeof pid !== 'number' || pid <= 0) return null;
  if (process.platform !== 'linux') return null;
  try {
    return fs.realpathSync(`/proc/${pid}/cwd`);
  } catch {
    return null;
  }
}
