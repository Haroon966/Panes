export type WorkspaceEditorContext = {
  workspaceRoot: string;
  terminalSessionId?: string;
};

export type WorkspaceFileResponse = {
  content: string;
  encoding: 'utf8';
  mtimeMs: number;
  path: string;
};

export async function fetchWorkspaceFile(
  relativePath: string,
  ctx: WorkspaceEditorContext
): Promise<WorkspaceFileResponse> {
  const q = new URLSearchParams();
  q.set('path', relativePath);
  if (ctx.workspaceRoot.trim()) q.set('workspaceRoot', ctx.workspaceRoot.trim());
  if (ctx.terminalSessionId?.trim()) q.set('terminalSessionId', ctx.terminalSessionId.trim());
  const res = await fetch(`/api/workspace/file?${q.toString()}`);
  const j = (await res.json()) as WorkspaceFileResponse & { error?: string };
  if (!res.ok) {
    throw new Error(j.error ?? res.statusText);
  }
  return j;
}

export async function saveWorkspaceFile(
  relativePath: string,
  content: string,
  ctx: WorkspaceEditorContext
): Promise<{ ok: boolean; path: string; bytes: number }> {
  const res = await fetch('/api/workspace/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: relativePath,
      content,
      workspaceRoot: ctx.workspaceRoot.trim() || undefined,
      terminalSessionId: ctx.terminalSessionId?.trim() || undefined,
    }),
  });
  const j = (await res.json()) as { ok?: boolean; path?: string; bytes?: number; error?: string };
  if (!res.ok) {
    throw new Error(j.error ?? res.statusText);
  }
  return { ok: !!j.ok, path: j.path ?? relativePath, bytes: j.bytes ?? 0 };
}

export type WorkspaceListEntry = { name: string; kind: 'file' | 'dir' };

export async function listWorkspaceDir(
  dir: string,
  ctx: WorkspaceEditorContext
): Promise<{ path: string; entries: WorkspaceListEntry[]; truncated: boolean }> {
  const q = new URLSearchParams();
  q.set('dir', dir || '.');
  if (ctx.workspaceRoot.trim()) q.set('workspaceRoot', ctx.workspaceRoot.trim());
  if (ctx.terminalSessionId?.trim()) q.set('terminalSessionId', ctx.terminalSessionId.trim());
  const res = await fetch(`/api/workspace/list?${q.toString()}`);
  const j = (await res.json()) as {
    path?: string;
    entries?: WorkspaceListEntry[];
    truncated?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(j.error ?? res.statusText);
  }
  return {
    path: j.path ?? dir,
    entries: j.entries ?? [],
    truncated: !!j.truncated,
  };
}
