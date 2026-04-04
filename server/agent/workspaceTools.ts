import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { requireApprovalForWrites } from './approvalEnv';
import { registerPendingWrite } from './pendingApprovalsStore';

const MAX_READ_BYTES = 400_000;
const MAX_WRITE_BYTES = Math.min(
  2_000_000,
  Math.max(10_000, Number(process.env.AGENT_MAX_WRITE_BYTES) || 750_000)
);
const MAX_LIST = 200;
const MAX_FIND = 80;
const MAX_DEPTH = 8;

async function ensureUnderRoot(rootAbs: string, rel: string): Promise<string> {
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

export function createWorkspaceTools(workspaceRootAbs: string) {
  const root = path.resolve(workspaceRootAbs);

  return [
    tool(
      async ({ relative_path }) => {
        const abs = await ensureUnderRoot(root, relative_path);
        const st = await fs.stat(abs).catch(() => null);
        if (!st) return `Not found: ${relative_path}`;
        if (!st.isFile()) return `Not a file: ${relative_path}`;
        if (st.size > MAX_READ_BYTES) {
          return `File too large (${st.size} bytes; max ${MAX_READ_BYTES}). Suggest reading a smaller slice or a different file.`;
        }
        const buf = await fs.readFile(abs);
        const text = buf.toString('utf8');
        const rel = path.relative(root, abs) || relative_path;
        return `--- ${rel} (${st.size} bytes) ---\n${text}`;
      },
      {
        name: 'read_workspace_file',
        description:
          'Read a UTF-8 text file from the workspace. Use a path relative to the workspace root (e.g. package.json, src/App.tsx). Call this before suggesting edits or explaining code.',
        schema: z.object({
          relative_path: z
            .string()
            .describe('Path relative to workspace root; use forward slashes'),
        }),
      }
    ),

    tool(
      async ({ relative_path, content, mode }) => {
        const bytes = Buffer.byteLength(content, 'utf8');
        if (bytes > MAX_WRITE_BYTES) {
          return `Refused: content too large (${bytes} bytes; max ${MAX_WRITE_BYTES}).`;
        }
        const writeMode = mode ?? 'replace';
        const abs = await ensureUnderRoot(root, relative_path);
        const exists = await fs.stat(abs).then(
          (st) => st.isFile(),
          () => false
        );
        if (writeMode === 'create' && exists) {
          return `Refused: file already exists (${relative_path}). Use mode "replace" to overwrite.`;
        }

        if (requireApprovalForWrites()) {
          const id = registerPendingWrite({
            workspaceRootAbs: root,
            relative_path,
            content,
            mode: writeMode,
          });
          return `PENDING_APPROVAL:${JSON.stringify({ id, relative_path, bytes })}`;
        }

        const dir = path.dirname(abs);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(abs, content, 'utf8');
        const rel = path.relative(root, abs) || relative_path;
        return `Wrote ${rel} (${bytes} bytes).`;
      },
      {
        name: 'write_workspace_file',
        description:
          'Create or overwrite a UTF-8 text file under the workspace. Parent directories are created automatically. Use mode "create" only for new files. When server env AGENT_REQUIRE_APPROVAL_FOR_WRITES is set, writes require user approval in the UI.',
        schema: z.object({
          relative_path: z
            .string()
            .describe('Path relative to workspace root; use forward slashes'),
          content: z.string().describe('Full file contents to write'),
          mode: z
            .enum(['create', 'replace'])
            .optional()
            .describe('create = fail if file exists; replace = overwrite (default)'),
        }),
      }
    ),

    tool(
      async ({ relative_path, old_string, new_string, replace_all }) => {
        if (old_string.length === 0) {
          return 'Refused: old_string must be non-empty.';
        }
        const abs = await ensureUnderRoot(root, relative_path);
        const st = await fs.stat(abs).catch(() => null);
        if (!st?.isFile()) return `Not a file: ${relative_path}`;
        if (st.size > MAX_READ_BYTES) {
          return `File too large to patch in one step (${st.size} bytes).`;
        }
        const buf = await fs.readFile(abs, 'utf8');
        if (!buf.includes(old_string)) {
          return `old_string not found in ${relative_path} (no changes made).`;
        }
        let next: string;
        if (replace_all) {
          const parts = buf.split(old_string);
          if (parts.length === 1) {
            return `old_string not found in ${relative_path}.`;
          }
          next = parts.join(new_string);
        } else {
          const i = buf.indexOf(old_string);
          next = buf.slice(0, i) + new_string + buf.slice(i + old_string.length);
        }
        const nb = Buffer.byteLength(next, 'utf8');
        if (nb > MAX_WRITE_BYTES) {
          return `Refused: result too large (${nb} bytes; max ${MAX_WRITE_BYTES}).`;
        }
        await fs.writeFile(abs, next, 'utf8');
        const rel = path.relative(root, abs) || relative_path;
        return `Updated ${rel} (${nb} bytes).`;
      },
      {
        name: 'search_replace_workspace_file',
        description:
          'Replace text in an existing UTF-8 workspace file. Prefer this over write_workspace_file when editing large files. Use replace_all true to change every occurrence.',
        schema: z.object({
          relative_path: z.string().describe('File path relative to workspace root'),
          old_string: z.string().describe('Exact substring to find (must match once unless replace_all)'),
          new_string: z.string().describe('Replacement text (may be empty to delete)'),
          replace_all: z
            .boolean()
            .optional()
            .describe('Replace every occurrence of old_string'),
        }),
      }
    ),

    tool(
      async ({ relative_path, max_entries }) => {
        const cap = Math.min(MAX_LIST, Math.max(8, max_entries ?? 80));
        const abs = await ensureUnderRoot(root, relative_path ?? '.');
        const st = await fs.stat(abs).catch(() => null);
        if (!st) return `Not found: ${relative_path ?? '.'}`;
        if (!st.isDirectory()) return `Not a directory: ${relative_path ?? '.'}`;
        const names = await fs.readdir(abs, { withFileTypes: true });
        const lines = names
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, cap)
          .map((d) => `${d.isDirectory() ? 'dir ' : 'file'} ${d.name}`);
        const rel = path.relative(root, abs) || '.';
        const more = names.length > cap ? `\n… and ${names.length - cap} more (increase max_entries or narrow path)` : '';
        return `Listing ${rel}/\n${lines.join('\n')}${more}`;
      },
      {
        name: 'list_workspace',
        description:
          'List files and subdirectories in a workspace folder. Use "" or "." for workspace root.',
        schema: z.object({
          relative_path: z
            .string()
            .optional()
            .describe('Directory relative to workspace root; omit for root'),
          max_entries: z
            .number()
            .optional()
            .describe(`Max entries (default 80, max ${MAX_LIST})`),
        }),
      }
    ),

    tool(
      async ({ name_contains, suffix, max_matches }) => {
        const cap = Math.min(MAX_FIND, Math.max(4, max_matches ?? 40));
        const suf = suffix?.trim() ?? '';
        const needle = name_contains?.trim().toLowerCase() ?? '';

        const matches: string[] = [];
        async function walk(dir: string, depth: number): Promise<void> {
          if (matches.length >= cap || depth > MAX_DEPTH) return;
          let entries: Dirent[];
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const e of entries) {
            if (matches.length >= cap) break;
            if (e.name.startsWith('.') && e.name !== '.') continue;
            const full = path.join(dir, e.name);
            const rel = path.relative(root, full);
            if (e.isDirectory()) {
              await walk(full, depth + 1);
            } else if (e.isFile()) {
              if (suf && !e.name.endsWith(suf)) continue;
              if (needle && !e.name.toLowerCase().includes(needle)) continue;
              matches.push(rel.split(path.sep).join('/'));
            }
          }
        }

        await walk(root, 0);
        if (matches.length === 0) {
          return `No files found (suffix=${suf || 'any'}, name_contains=${needle || 'any'}, depth≤${MAX_DEPTH}).`;
        }
        return matches.sort().join('\n');
      },
      {
        name: 'find_workspace_files',
        description:
          'Search the workspace for files by optional filename suffix (e.g. ".ts", ".tsx") and/or substring in the basename. Use before read_workspace_file when you do not know exact paths.',
        schema: z.object({
          suffix: z
            .string()
            .optional()
            .describe('Filename must end with this (e.g. .ts, .json)'),
          name_contains: z
            .string()
            .optional()
            .describe('Case-insensitive substring of the file name'),
          max_matches: z.number().optional().describe(`Max paths (default 40, max ${MAX_FIND})`),
        }),
      }
    ),
  ];
}
