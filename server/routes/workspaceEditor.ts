import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { resolveEffectiveWorkspaceRoot } from '../agent/workspaceRoot';
import { MAX_LIST_DIR, MAX_READ_BYTES, MAX_WRITE_BYTES } from '../agent/workspaceTools';
import { resolveWorkspaceRootFromPrefs } from '../lib/appPrefs';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';

/**
 * Human-driven workspace file read/write for the UI editor.
 * Not subject to AGENT_REQUIRE_APPROVAL_FOR_WRITES (that applies to agent tools only).
 */
export const workspaceEditorRouter = Router();

function parseQueryString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

function workspaceRootFromReq(req: Request): string {
  const body = req.body as { workspaceRoot?: string; terminalSessionId?: string } | undefined;
  const qWorkspace =
    typeof req.query.workspaceRoot === 'string' ? req.query.workspaceRoot : undefined;
  const hint = parseQueryString(body?.workspaceRoot) ?? parseQueryString(qWorkspace);
  const terminalSessionId =
    parseQueryString(body?.terminalSessionId) ??
    (typeof req.query.terminalSessionId === 'string' ? req.query.terminalSessionId.trim() : undefined);
  return resolveEffectiveWorkspaceRoot({
    workspaceRootHint: resolveWorkspaceRootFromPrefs(hint),
    terminalSessionId: terminalSessionId || undefined,
  });
}

workspaceEditorRouter.get('/workspace/file', async (req: Request, res: Response) => {
  const rel = parseQueryString(req.query.path);
  if (!rel) {
    res.status(400).json({ error: 'path query parameter is required (workspace-relative)' });
    return;
  }
  let root: string;
  try {
    root = workspaceRootFromReq(req);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid workspace root' });
    return;
  }
  let abs: string;
  try {
    abs = resolveWorkspaceFileAbs(root, rel);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid path' });
    return;
  }
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isFile()) {
    res.status(404).json({ error: 'Not found or not a file' });
    return;
  }
  if (st.size > MAX_READ_BYTES) {
    res.status(413).json({
      error: `File too large (${st.size} bytes; max ${MAX_READ_BYTES})`,
    });
    return;
  }
  try {
    const content = await fs.readFile(abs, 'utf8');
    res.json({
      content,
      encoding: 'utf8' as const,
      mtimeMs: st.mtimeMs,
      path: path.relative(root, abs).split(path.sep).join('/') || rel,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Read failed' });
  }
});

workspaceEditorRouter.put('/workspace/file', async (req: Request, res: Response) => {
  const body = req.body as {
    path?: string;
    content?: string;
    workspaceRoot?: string;
    terminalSessionId?: string;
  };
  const rel = typeof body?.path === 'string' ? body.path.trim() : '';
  const content = typeof body?.content === 'string' ? body.content : undefined;
  if (!rel) {
    res.status(400).json({ error: 'path is required (workspace-relative)' });
    return;
  }
  if (content === undefined) {
    res.status(400).json({ error: 'content is required (string)' });
    return;
  }
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_WRITE_BYTES) {
    res.status(413).json({ error: `Content too large (${bytes} bytes; max ${MAX_WRITE_BYTES})` });
    return;
  }
  let root: string;
  try {
    root = resolveEffectiveWorkspaceRoot({
      workspaceRootHint: resolveWorkspaceRootFromPrefs(
        typeof body.workspaceRoot === 'string' ? body.workspaceRoot : undefined
      ),
      terminalSessionId:
        typeof body.terminalSessionId === 'string' ? body.terminalSessionId.trim() : undefined,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid workspace root' });
    return;
  }
  let abs: string;
  try {
    abs = resolveWorkspaceFileAbs(root, rel);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid path' });
    return;
  }
  try {
    const dir = path.dirname(abs);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    const outRel = path.relative(root, abs).split(path.sep).join('/') || rel;
    res.json({ ok: true, path: outRel, bytes });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Write failed' });
  }
});

workspaceEditorRouter.get('/workspace/list', async (req: Request, res: Response) => {
  const dirRel = parseQueryString(req.query.dir) ?? '.';
  let root: string;
  try {
    root = workspaceRootFromReq(req);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid workspace root' });
    return;
  }
  let abs: string;
  try {
    abs = resolveWorkspaceFileAbs(root, dirRel);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid path' });
    return;
  }
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isDirectory()) {
    res.status(404).json({ error: 'Not found or not a directory' });
    return;
  }
  try {
    const names = await fs.readdir(abs, { withFileTypes: true });
    const sorted = [...names].sort((a, b) => a.name.localeCompare(b.name));
    const cap = MAX_LIST_DIR;
    const slice = sorted.slice(0, cap);
    const entries = slice.map((d) => ({
      name: d.name,
      kind: d.isDirectory() ? ('dir' as const) : ('file' as const),
    }));
    res.json({
      path: path.relative(root, abs).split(path.sep).join('/') || '.',
      entries,
      truncated: sorted.length > cap,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'List failed' });
  }
});
