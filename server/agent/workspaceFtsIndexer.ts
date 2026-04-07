import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { getDb } from '../db/client';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'target',
  '__pycache__',
  'venv',
  '.venv',
  '.turbo',
  'coverage',
  '.cache',
]);

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.sql',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.less',
  '.yml',
  '.yaml',
  '.toml',
  '.sh',
  '.fish',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.vue',
  '.svelte',
  '.rb',
  '.php',
  '.ex',
  '.exs',
]);

const DEFAULT_MAX_FILES = Math.min(
  5000,
  Math.max(100, Number(process.env.AGENT_WORKSPACE_FTS_MAX_FILES) || 2500)
);
const DEFAULT_MAX_BYTES_PER_FILE = Math.min(
  256_000,
  Math.max(1024, Number(process.env.AGENT_WORKSPACE_FTS_MAX_BYTES) || 65_536)
);

export function workspaceFtsDisabled(): boolean {
  return process.env.AGENT_DISABLE_WORKSPACE_FTS === '1';
}

function isTextExt(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return TEXT_EXT.has(ext);
}

function walkFiles(rootAbs: string): string[] {
  const out: string[] = [];
  const stack: string[] = [rootAbs];
  while (stack.length && out.length < DEFAULT_MAX_FILES) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= DEFAULT_MAX_FILES) break;
      const name = ent.name;
      if (name === '.' || name === '..') continue;
      const full = path.join(cur, name);
      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(name)) continue;
        stack.push(full);
      } else if (ent.isFile() && isTextExt(name)) {
        out.push(full);
      }
    }
  }
  return out;
}

function toRel(rootAbs: string, abs: string): string {
  return path.relative(rootAbs, abs).replace(/\\/g, '/');
}

/** Build a conservative FTS5 OR query from free text (drops specials). */
export function sanitizeFtsUserQuery(raw: string): string {
  const t = raw.trim().slice(0, 240);
  if (!t) return '';
  const parts = t
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 12)
    .map((p) => p.replace(/[^\p{L}\p{N}_./+-]/gu, ''))
    .filter((p) => p.length >= 2);
  if (!parts.length) return '';
  return parts.map((p) => `"${p.replace(/"/g, '')}"`).join(' OR ');
}

export function rebuildWorkspaceFtsIndex(workspaceRootAbs: string, db: Database.Database = getDb()): {
  filesIndexed: number;
  bytesRead: number;
} {
  const root = path.resolve(workspaceRootAbs);
  const del = db.prepare('DELETE FROM workspace_fts');
  const ins = db.prepare('INSERT INTO workspace_fts (relpath, body) VALUES (?, ?)');
  const run = db.transaction(() => {
    del.run();
    const absPaths = walkFiles(root);
    let bytesRead = 0;
    let n = 0;
    for (const abs of absPaths) {
      let st: fs.Stats;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size > DEFAULT_MAX_BYTES_PER_FILE) continue;
      let buf: Buffer;
      try {
        buf = fs.readFileSync(abs);
      } catch {
        continue;
      }
      if (buf.includes(0)) continue;
      let text: string;
      try {
        text = buf.toString('utf8');
      } catch {
        continue;
      }
      if (!text.trim()) continue;
      const rel = toRel(root, abs);
      try {
        resolveWorkspaceFileAbs(root, rel);
      } catch {
        continue;
      }
      const body = text.length > DEFAULT_MAX_BYTES_PER_FILE ? text.slice(0, DEFAULT_MAX_BYTES_PER_FILE) : text;
      bytesRead += body.length;
      ins.run(rel, body);
      n++;
    }
    return { filesIndexed: n, bytesRead };
  });
  return run();
}

export type WorkspaceFtsHit = { relpath: string; snippet: string };

export function searchWorkspaceFts(
  workspaceRootAbs: string,
  userQuery: string,
  limit: number,
  db: Database.Database = getDb()
): WorkspaceFtsHit[] {
  const root = path.resolve(workspaceRootAbs);
  const q = sanitizeFtsUserQuery(userQuery);
  if (!q) return [];
  const lim = Math.min(40, Math.max(1, Math.floor(limit) || 15));
  const stmt = db.prepare(
    `SELECT relpath,
            snippet(workspace_fts, 1, '«', '»', '…', 24) AS snip
     FROM workspace_fts
     WHERE workspace_fts MATCH ?
     LIMIT ?`
  );
  let rows: { relpath: string; snip: string }[];
  try {
    rows = stmt.all(q, lim) as { relpath: string; snip: string }[];
  } catch {
    return [];
  }
  const out: WorkspaceFtsHit[] = [];
  for (const r of rows) {
    if (!r.relpath) continue;
    try {
      resolveWorkspaceFileAbs(root, r.relpath);
    } catch {
      continue;
    }
    out.push({ relpath: r.relpath, snippet: r.snip || '' });
  }
  return out;
}

export function workspaceFtsRowCount(db: Database.Database = getDb()): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM workspace_fts').get() as { c: number } | undefined;
  return row?.c ?? 0;
}
