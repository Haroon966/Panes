import type { IPty } from 'node-pty';

type Entry = { pty: IPty; shellLabel: string };

const bySession = new Map<string, Entry>();

export function registerPtySession(sessionId: string, pty: IPty, shellLabel: string): void {
  const prev = bySession.get(sessionId);
  if (prev && prev.pty !== pty) {
    try {
      prev.pty.kill();
    } catch {
      /* ignore */
    }
  }
  bySession.set(sessionId, { pty, shellLabel });
}

/** Only removes if `pty` matches the registered instance (avoids deleting a reconnect). */
export function unregisterPtySession(sessionId: string, pty: IPty): void {
  const cur = bySession.get(sessionId);
  if (cur?.pty === pty) {
    bySession.delete(sessionId);
  }
}

export function getPtySession(sessionId: string): Entry | undefined {
  return bySession.get(sessionId);
}
