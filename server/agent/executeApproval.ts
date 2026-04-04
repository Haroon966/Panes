import fs from 'node:fs/promises';
import path from 'node:path';
import { takePending, type PendingWriteEntry } from './pendingApprovalsStore';
import { executeShellCommand } from './shellTool';

function ensureUnderRoot(rootAbs: string, rel: string): string {
  const trimmed = rel.trim() || '.';
  const normalized = path.normalize(trimmed).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.resolve(rootAbs, normalized);
  const rootResolved = path.resolve(rootAbs);
  const relCheck = path.relative(rootResolved, abs);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    throw new Error('Path escapes workspace root');
  }
  return abs;
}

async function applyWrite(entry: PendingWriteEntry): Promise<string> {
  const abs = ensureUnderRoot(entry.workspaceRootAbs, entry.relative_path);
  const exists = await fs.stat(abs).then(
    (st) => st.isFile(),
    () => false
  );
  if (entry.mode === 'create' && exists) {
    throw new Error(`File already exists: ${entry.relative_path}`);
  }
  const dir = path.dirname(abs);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(abs, entry.content, 'utf8');
  const rel = path.relative(path.resolve(entry.workspaceRootAbs), abs) || entry.relative_path;
  const bytes = Buffer.byteLength(entry.content, 'utf8');
  return `Wrote ${rel} (${bytes} bytes).`;
}

export async function executeApproved(
  approvalId: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const entry = takePending(approvalId);
  if (!entry) {
    return { ok: false, error: 'Unknown or expired approval id' };
  }
  try {
    if (entry.kind === 'write') {
      const message = await applyWrite(entry);
      return { ok: true, message };
    }
    if (entry.kind === 'shell') {
      const message = await executeShellCommand(
        entry.workspaceRootAbs,
        entry.argv,
        entry.terminalSessionId
      );
      return { ok: true, message };
    }
    return { ok: false, error: 'Unknown pending kind' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
