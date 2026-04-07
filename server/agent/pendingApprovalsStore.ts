import { randomUUID } from 'node:crypto';

export type PendingWriteEntry = {
  kind: 'write';
  id: string;
  workspaceRootAbs: string;
  relative_path: string;
  content: string;
  mode: 'create' | 'replace';
  createdAt: number;
};

export type PendingShellEntry = {
  kind: 'shell';
  id: string;
  workspaceRootAbs: string;
  argv: string[];
  /** When set, approved runs go through the browser-connected PTY for this tab. */
  terminalSessionId?: string;
  createdAt: number;
};

export type PendingPatchEntry = {
  kind: 'patch';
  id: string;
  workspaceRootAbs: string;
  relative_path: string;
  old_string: string;
  new_string: string;
  replace_all: boolean;
  createdAt: number;
};

export type PendingDeleteEntry = {
  kind: 'delete';
  id: string;
  workspaceRootAbs: string;
  relative_path: string;
  /** When true, allow deleting an empty directory; otherwise only regular files. */
  allow_empty_directory: boolean;
  createdAt: number;
};

export type PendingCopyEntry = {
  kind: 'copy';
  id: string;
  workspaceRootAbs: string;
  source_path: string;
  dest_path: string;
  overwrite: boolean;
  createdAt: number;
};

export type PendingMoveEntry = {
  kind: 'move';
  id: string;
  workspaceRootAbs: string;
  source_path: string;
  dest_path: string;
  overwrite: boolean;
  createdAt: number;
};

export type PendingEntry =
  | PendingWriteEntry
  | PendingShellEntry
  | PendingPatchEntry
  | PendingDeleteEntry
  | PendingCopyEntry
  | PendingMoveEntry;

const pending = new Map<string, PendingEntry>();

function ttlMs(): number {
  const n = Number(process.env.AGENT_APPROVAL_TTL_MS);
  return Number.isFinite(n) && n > 10_000 ? Math.min(n, 3_600_000) : 900_000;
}

export function sweepExpiredApprovals(): void {
  const t = Date.now();
  const maxAge = ttlMs();
  for (const [id, e] of pending) {
    if (t - e.createdAt > maxAge) pending.delete(id);
  }
}

export function registerPendingWrite(
  input: Omit<PendingWriteEntry, 'id' | 'kind' | 'createdAt'>
): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingWriteEntry = {
    kind: 'write',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function registerPendingShell(input: Omit<PendingShellEntry, 'id' | 'kind' | 'createdAt'>): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingShellEntry = {
    kind: 'shell',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function registerPendingPatch(input: Omit<PendingPatchEntry, 'id' | 'kind' | 'createdAt'>): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingPatchEntry = {
    kind: 'patch',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function registerPendingDelete(
  input: Omit<PendingDeleteEntry, 'id' | 'kind' | 'createdAt'>
): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingDeleteEntry = {
    kind: 'delete',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function registerPendingCopy(input: Omit<PendingCopyEntry, 'id' | 'kind' | 'createdAt'>): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingCopyEntry = {
    kind: 'copy',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function registerPendingMove(input: Omit<PendingMoveEntry, 'id' | 'kind' | 'createdAt'>): string {
  sweepExpiredApprovals();
  const id = randomUUID();
  const entry: PendingMoveEntry = {
    kind: 'move',
    id,
    ...input,
    createdAt: Date.now(),
  };
  pending.set(id, entry);
  return id;
}

export function takePending(id: string): PendingEntry | undefined {
  sweepExpiredApprovals();
  const e = pending.get(id);
  if (!e) return undefined;
  pending.delete(id);
  return e;
}

export function peekPending(id: string): PendingEntry | undefined {
  sweepExpiredApprovals();
  return pending.get(id);
}

export function rejectPending(id: string): boolean {
  sweepExpiredApprovals();
  return pending.delete(id);
}
