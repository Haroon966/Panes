import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';
import { takePending, type PendingWriteEntry } from './pendingApprovalsStore';
import {
  applyCopyWorkspaceFile,
  applyDeleteWorkspaceFile,
  applyMoveWorkspaceFile,
  applySearchReplaceInWorkspace,
} from './workspaceTools';
import { executeShellCommand } from './shellTool';
import {
  buildClientWorkspaceDirtyPathSet,
  clientWorkspaceDirtyBlockedMessage,
  sanitizeClientWorkspaceDirtyPaths,
} from './workspaceClientDirtyPaths';

async function applyWrite(entry: PendingWriteEntry): Promise<string> {
  const abs = resolveWorkspaceFileAbs(entry.workspaceRootAbs, entry.relative_path);
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
  approvalId: string,
  opts?: { clientWorkspaceDirtyPaths?: unknown }
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const entry = takePending(approvalId);
  if (!entry) {
    return { ok: false, error: 'Unknown or expired approval id' };
  }
  const dirtyList = sanitizeClientWorkspaceDirtyPaths(opts?.clientWorkspaceDirtyPaths);
  const dirty =
    dirtyList.length > 0
      ? buildClientWorkspaceDirtyPathSet(entry.workspaceRootAbs, dirtyList)
      : undefined;
  try {
    if (entry.kind === 'write') {
      const block = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.relative_path,
        'applying this write'
      );
      if (block) return { ok: false, error: block };
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
    if (entry.kind === 'patch') {
      const block = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.relative_path,
        'applying this patch'
      );
      if (block) return { ok: false, error: block };
      const message = await applySearchReplaceInWorkspace(
        entry.workspaceRootAbs,
        entry.relative_path,
        entry.old_string,
        entry.new_string,
        entry.replace_all
      );
      return { ok: true, message };
    }
    if (entry.kind === 'delete') {
      const block = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.relative_path,
        'deleting this path'
      );
      if (block) return { ok: false, error: block };
      const message = await applyDeleteWorkspaceFile(
        entry.workspaceRootAbs,
        entry.relative_path,
        entry.allow_empty_directory
      );
      return { ok: true, message };
    }
    if (entry.kind === 'copy') {
      const bs = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.source_path,
        'copying (source has unsaved editor changes)'
      );
      if (bs) return { ok: false, error: bs };
      const bd = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.dest_path,
        'copying (destination has unsaved editor changes)'
      );
      if (bd) return { ok: false, error: bd };
      const message = await applyCopyWorkspaceFile(
        entry.workspaceRootAbs,
        entry.source_path,
        entry.dest_path,
        entry.overwrite
      );
      return { ok: true, message };
    }
    if (entry.kind === 'move') {
      const bs = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.source_path,
        'moving (source has unsaved editor changes)'
      );
      if (bs) return { ok: false, error: bs };
      const bd = clientWorkspaceDirtyBlockedMessage(
        dirty,
        entry.workspaceRootAbs,
        entry.dest_path,
        'moving (destination has unsaved editor changes)'
      );
      if (bd) return { ok: false, error: bd };
      const message = await applyMoveWorkspaceFile(
        entry.workspaceRootAbs,
        entry.source_path,
        entry.dest_path,
        entry.overwrite
      );
      return { ok: true, message };
    }
    return { ok: false, error: 'Unknown pending kind' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
