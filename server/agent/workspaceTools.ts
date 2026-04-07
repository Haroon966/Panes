import type { Dirent } from 'node:fs';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import readline from 'node:readline';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';
import { formatReadToolRedactionFootnote, redactLikelySecrets } from '../lib/agentSecretLeak';
import { agentReadOnlyMode, requireApprovalForWrites } from './approvalEnv';
import { readBeforeWriteBlockedMessage, registerPathReadForWriteGuard } from './workspaceReadBeforeWrite';
import { clientWorkspaceDirtyBlockedMessage } from './workspaceClientDirtyPaths';
import {
  registerPendingCopy,
  registerPendingDelete,
  registerPendingMove,
  registerPendingPatch,
  registerPendingWrite,
} from './pendingApprovalsStore';

export const MAX_READ_BYTES = 400_000;
const MAX_LINE_SLICE = 400;
export const MAX_WRITE_BYTES = Math.min(
  2_000_000,
  Math.max(10_000, Number(process.env.AGENT_MAX_WRITE_BYTES) || 750_000)
);
export const MAX_LIST_DIR = 200;
const MAX_LIST = MAX_LIST_DIR;
const MAX_FIND = 80;
const MAX_DEPTH = 8;

async function readWorkspaceFileLines(
  abs: string,
  startLine: number,
  endLine: number
): Promise<{ text: string; from: number; to: number }> {
  const rl = readline.createInterface({ input: createReadStream(abs), crlfDelay: Infinity });
  let lineNo = 0;
  let lastInSlice = 0;
  const out: string[] = [];
  try {
    for await (const line of rl) {
      lineNo++;
      if (lineNo < startLine) continue;
      if (lineNo > endLine) break;
      out.push(`${lineNo}|${line}`);
      lastInSlice = lineNo;
    }
  } finally {
    rl.close();
  }
  const to = lastInSlice > 0 ? lastInSlice : startLine - 1;
  return { text: out.join('\n'), from: startLine, to };
}

/** Apply search_replace to a workspace file (used by the tool and HITL approve). */
export async function applySearchReplaceInWorkspace(
  workspaceRootAbs: string,
  relative_path: string,
  old_string: string,
  new_string: string,
  replace_all: boolean | undefined
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  if (!old_string.length) {
    throw new Error('old_string must be non-empty');
  }
  const abs = resolveWorkspaceFileAbs(root, relative_path);
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isFile()) throw new Error(`Not a file: ${relative_path}`);
  if (st.size > MAX_READ_BYTES) {
    throw new Error(`File too large to patch in one step (${st.size} bytes).`);
  }
  const buf = await fs.readFile(abs, 'utf8');
  if (!buf.includes(old_string)) {
    throw new Error(`old_string not found in ${relative_path} (no changes made).`);
  }
  let next: string;
  if (replace_all) {
    const parts = buf.split(old_string);
    if (parts.length === 1) {
      throw new Error(`old_string not found in ${relative_path}.`);
    }
    next = parts.join(new_string);
  } else {
    const i = buf.indexOf(old_string);
    next = buf.slice(0, i) + new_string + buf.slice(i + old_string.length);
  }
  const nb = Buffer.byteLength(next, 'utf8');
  if (nb > MAX_WRITE_BYTES) {
    throw new Error(`Refused: result too large (${nb} bytes; max ${MAX_WRITE_BYTES}).`);
  }
  await fs.writeFile(abs, next, 'utf8');
  const rel = path.relative(root, abs) || relative_path;
  return `Updated ${rel} (${nb} bytes).`;
}

/** Delete a workspace file, or an empty directory when `allowEmptyDirectory` is true. */
export async function applyDeleteWorkspaceFile(
  workspaceRootAbs: string,
  relative_path: string,
  allowEmptyDirectory: boolean
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const abs = resolveWorkspaceFileAbs(root, relative_path);
  const st = await fs.stat(abs).catch(() => null);
  if (!st) throw new Error(`Not found: ${relative_path}`);
  const rel = path.relative(root, abs).split(path.sep).join('/') || relative_path;
  if (st.isFile()) {
    await fs.unlink(abs);
    return `Deleted file ${rel}.`;
  }
  if (st.isDirectory()) {
    if (!allowEmptyDirectory) {
      throw new Error(
        `Refused: ${relative_path} is a directory. Pass allow_empty_directory true only to remove an empty folder.`
      );
    }
    await fs.rmdir(abs);
    return `Deleted empty directory ${rel}.`;
  }
  throw new Error(`Not a file or directory: ${relative_path}`);
}

/** Copy a regular file within the workspace. */
export async function applyCopyWorkspaceFile(
  workspaceRootAbs: string,
  source_path: string,
  dest_path: string,
  overwrite: boolean
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const srcAbs = resolveWorkspaceFileAbs(root, source_path);
  const destAbs = resolveWorkspaceFileAbs(root, dest_path);
  const srcSt = await fs.stat(srcAbs).catch(() => null);
  if (!srcSt?.isFile()) throw new Error(`Source is not a file: ${source_path}`);
  const destSt = await fs.stat(destAbs).catch(() => null);
  if (destSt && !overwrite) throw new Error(`Destination exists: ${dest_path} (pass overwrite true to replace).`);
  if (destSt?.isDirectory()) throw new Error(`Destination is a directory: ${dest_path}`);
  await fs.mkdir(path.dirname(destAbs), { recursive: true });
  if (overwrite && destSt?.isFile()) {
    await fs.unlink(destAbs);
  }
  await fs.copyFile(srcAbs, destAbs);
  const relS = path.relative(root, srcAbs).split(path.sep).join('/');
  const relD = path.relative(root, destAbs).split(path.sep).join('/');
  return `Copied ${relS} → ${relD} (${srcSt.size} bytes).`;
}

/** Move/rename a regular file within the workspace. */
export async function applyMoveWorkspaceFile(
  workspaceRootAbs: string,
  source_path: string,
  dest_path: string,
  overwrite: boolean
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const srcAbs = resolveWorkspaceFileAbs(root, source_path);
  const destAbs = resolveWorkspaceFileAbs(root, dest_path);
  const srcSt = await fs.stat(srcAbs).catch(() => null);
  if (!srcSt?.isFile()) throw new Error(`Source is not a file: ${source_path}`);
  const destSt = await fs.stat(destAbs).catch(() => null);
  if (destSt && !overwrite) throw new Error(`Destination exists: ${dest_path} (pass overwrite true to replace).`);
  if (destSt?.isDirectory()) throw new Error(`Destination is a directory: ${dest_path}`);
  await fs.mkdir(path.dirname(destAbs), { recursive: true });
  if (overwrite && destSt?.isFile()) {
    await fs.unlink(destAbs);
  }
  const relS = path.relative(root, srcAbs).split(path.sep).join('/');
  const relD = path.relative(root, destAbs).split(path.sep).join('/');
  try {
    await fs.rename(srcAbs, destAbs);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'EXDEV') {
      await fs.copyFile(srcAbs, destAbs);
      await fs.unlink(srcAbs);
    } else {
      throw e;
    }
  }
  return `Moved ${relS} → ${relD} (${srcSt.size} bytes).`;
}

export function createWorkspaceTools(
  workspaceRootAbs: string,
  opts?: {
    userAlwaysConfirmMutations?: boolean;
    workspaceReadPathsThisTurn?: Set<string>;
    clientWorkspaceDirtyPathSet?: Set<string>;
  }
) {
  const root = path.resolve(workspaceRootAbs);
  const writesNeedApproval =
    !!opts?.userAlwaysConfirmMutations || requireApprovalForWrites();
  const readOnly = agentReadOnlyMode();
  const readTracker = opts?.workspaceReadPathsThisTurn;
  const dirty = opts?.clientWorkspaceDirtyPathSet;

  return [
    tool(
      async ({ relative_path, start_line, end_line }) => {
        const abs = resolveWorkspaceFileAbs(root, relative_path);
        const st = await fs.stat(abs).catch(() => null);
        if (!st) return `Not found: ${relative_path}`;
        if (!st.isFile()) return `Not a file: ${relative_path}`;

        if (end_line != null && start_line == null) {
          return 'Refused: end_line requires start_line.';
        }

        if (start_line != null) {
          const s = Math.max(1, Math.floor(start_line));
          const e =
            end_line != null ? Math.max(s, Math.floor(end_line)) : Math.min(s + MAX_LINE_SLICE - 1, s + 99_999);
          const span = e - s + 1;
          if (span > MAX_LINE_SLICE) {
            return `Refused: line range is ${span} lines (max ${MAX_LINE_SLICE}). Narrow the range or omit line numbers for a full read (subject to size cap).`;
          }
          const { text, from, to } = await readWorkspaceFileLines(abs, s, e);
          const rel = path.relative(root, abs) || relative_path;
          registerPathReadForWriteGuard(readTracker, root, relative_path);
          if (!text.length) {
            return `Lines ${from}-${Math.max(to, from)} of ${rel}: (no lines in range; file may be shorter than start_line).`;
          }
          const { text: body, labels } = redactLikelySecrets(text);
          return `--- ${rel} lines ${from}-${to} ---\n${body}${formatReadToolRedactionFootnote(labels)}`;
        }

        if (st.size > MAX_READ_BYTES) {
          return `File too large (${st.size} bytes; max ${MAX_READ_BYTES}). Use start_line/end_line for a slice (up to ${MAX_LINE_SLICE} lines), grep_workspace_content, or a different file.`;
        }
        const buf = await fs.readFile(abs);
        const raw = buf.toString('utf8');
        const rel = path.relative(root, abs) || relative_path;
        registerPathReadForWriteGuard(readTracker, root, relative_path);
        const { text, labels } = redactLikelySecrets(raw);
        return `--- ${rel} (${st.size} bytes) ---\n${text}${formatReadToolRedactionFootnote(labels)}`;
      },
      {
        name: 'read_workspace_file',
        description:
          'Read a UTF-8 text file from the workspace. Optional start_line / end_line (1-based, inclusive) returns up to 400 lines without loading huge files whole. Call before edits; after search_replace, re-read to verify.',
        schema: z
          .object({
            relative_path: z
              .string()
              .describe('Path relative to workspace root; use forward slashes'),
            start_line: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('First line to include (1-based). If set without end_line, reads up to 400 lines from here.'),
            end_line: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('Last line to include (1-based); requires start_line'),
          })
          .refine((o) => o.end_line == null || o.start_line != null, {
            message: 'end_line requires start_line',
          })
          .refine(
            (o) =>
              o.start_line == null ||
              o.end_line == null ||
              o.end_line >= o.start_line,
            { message: 'end_line must be >= start_line' }
          ),
      }
    ),

    ...(readOnly
      ? []
      : [
          tool(
      async ({ relative_path, content, mode }) => {
        const bytes = Buffer.byteLength(content, 'utf8');
        if (bytes > MAX_WRITE_BYTES) {
          return `Refused: content too large (${bytes} bytes; max ${MAX_WRITE_BYTES}).`;
        }
        const writeMode = mode ?? 'replace';
        const abs = resolveWorkspaceFileAbs(root, relative_path);
        const exists = await fs.stat(abs).then(
          (st) => st.isFile(),
          () => false
        );
        if (writeMode === 'create' && exists) {
          return `Refused: file already exists (${relative_path}). Use mode "replace" to overwrite.`;
        }
        if (writeMode === 'replace' && exists) {
          const block = readBeforeWriteBlockedMessage(
            readTracker,
            root,
            relative_path,
            'overwriting this file with write_workspace_file'
          );
          if (block) return block;
        }
        const dirtyBlock = clientWorkspaceDirtyBlockedMessage(
          dirty,
          root,
          relative_path,
          writeMode === 'create' ? 'writing this path while it has unsaved editor changes' : 'overwriting with write_workspace_file'
        );
        if (dirtyBlock) return dirtyBlock;

        if (writesNeedApproval) {
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
              const blockPre = readBeforeWriteBlockedMessage(
                readTracker,
                root,
                relative_path,
                'patching this file with search_replace_workspace_file'
              );
              if (blockPre) return blockPre;
              const dirtyPatch = clientWorkspaceDirtyBlockedMessage(
                dirty,
                root,
                relative_path,
                'patching with search_replace_workspace_file'
              );
              if (dirtyPatch) return dirtyPatch;
              try {
                if (writesNeedApproval) {
                  const abs = resolveWorkspaceFileAbs(root, relative_path);
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
                  const id = registerPendingPatch({
                    workspaceRootAbs: root,
                    relative_path,
                    old_string,
                    new_string,
                    replace_all: replace_all ?? false,
                  });
                  const preview =
                    old_string.length > 100 ? `${old_string.slice(0, 100)}…` : old_string;
                  return `PENDING_APPROVAL:${JSON.stringify({ id, relative_path, patch_preview: preview, bytes: nb })}`;
                }
                return await applySearchReplaceInWorkspace(
                  root,
                  relative_path,
                  old_string,
                  new_string,
                  replace_all
                );
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            },
            {
              name: 'search_replace_workspace_file',
              description:
                'Replace text in an existing UTF-8 workspace file. Prefer this over write_workspace_file when editing large files. Use replace_all true to change every occurrence. When AGENT_REQUIRE_APPROVAL_FOR_WRITES is set, applies after user approval like writes.',
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
        ]),

    tool(
      async ({ relative_path, max_entries }) => {
        const cap = Math.min(MAX_LIST, Math.max(8, max_entries ?? 80));
        const abs = resolveWorkspaceFileAbs(root, relative_path ?? '.');
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
          'Search the workspace for files by optional filename suffix (e.g. ".ts", ".tsx") and/or substring in the **basename only** (not file contents). If name_contains returns no hits, the feature may use different words in paths (e.g. user says "navbar" but code uses Header.tsx) — omit name_contains, list src/components, or grep content instead. For matches inside file contents, use grep_workspace_content.',
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

    tool(
      async ({ relative_path }) => {
        const rel = (relative_path ?? '.').trim() || '.';
        try {
          const abs = resolveWorkspaceFileAbs(root, rel);
          const st = await fs.stat(abs).catch(() => null);
          if (!st) {
            return `Path "${rel}": not found (under workspace root).`;
          }
          const kind = st.isDirectory() ? 'directory' : st.isFile() ? 'file' : 'other';
          const relOut = path.relative(root, abs).split(path.sep).join('/') || rel;
          const parts = [`Path: ${relOut}`, `kind: ${kind}`];
          if (st.isFile()) {
            parts.push(`size_bytes: ${st.size}`, `mtime_ms: ${Math.floor(st.mtimeMs)}`);
          }
          return parts.join('\n');
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
      {
        name: 'workspace_path_stat',
        description:
          'Check whether a workspace-relative path exists and whether it is a file or directory; for files, returns size and mtime. Use before destructive operations or when deciding between read vs list_workspace.',
        schema: z.object({
          relative_path: z
            .string()
            .optional()
            .describe('Path relative to workspace root; omit or "." for root'),
        }),
      }
    ),

    ...(readOnly
      ? []
      : [
          tool(
            async ({ relative_path, allow_empty_directory }) => {
              const rel = relative_path.trim();
              if (!rel) return 'Refused: relative_path is required.';
              const blockDel = readBeforeWriteBlockedMessage(
                readTracker,
                root,
                rel,
                'deleting this path'
              );
              if (blockDel) return blockDel;
              const dirtyDel = clientWorkspaceDirtyBlockedMessage(dirty, root, rel, 'deleting this path');
              if (dirtyDel) return dirtyDel;
              try {
                const allowDir = allow_empty_directory === true;
                if (writesNeedApproval) {
                  const id = registerPendingDelete({
                    workspaceRootAbs: root,
                    relative_path: rel,
                    allow_empty_directory: allowDir,
                  });
                  return `PENDING_APPROVAL:${JSON.stringify({
                    id,
                    relative_path: rel,
                    allow_empty_directory: allowDir,
                  })}`;
                }
                return await applyDeleteWorkspaceFile(root, rel, allowDir);
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            },
            {
              name: 'delete_workspace_file',
              description:
                'Delete a regular file under the workspace, or an empty directory when allow_empty_directory is true. Does not delete non-empty directories. When AGENT_REQUIRE_APPROVAL_FOR_WRITES is set, requires user approval like writes.',
              schema: z.object({
                relative_path: z.string().describe('Path relative to workspace root'),
                allow_empty_directory: z
                  .boolean()
                  .optional()
                  .describe('If true, allow deleting an empty directory at relative_path (default false = files only)'),
              }),
            }
          ),

          tool(
            async ({ source_path, dest_path, overwrite }) => {
              const src = source_path.trim();
              const dst = dest_path.trim();
              if (!src || !dst) return 'Refused: source_path and dest_path are required.';
              const blockCopy = readBeforeWriteBlockedMessage(
                readTracker,
                root,
                src,
                'copying this file (read the source first)'
              );
              if (blockCopy) return blockCopy;
              const dirtySrc = clientWorkspaceDirtyBlockedMessage(dirty, root, src, 'copying (source has unsaved editor changes)');
              if (dirtySrc) return dirtySrc;
              const dirtyDst = clientWorkspaceDirtyBlockedMessage(dirty, root, dst, 'copying (destination has unsaved editor changes)');
              if (dirtyDst) return dirtyDst;
              try {
                const ow = overwrite === true;
                if (writesNeedApproval) {
                  const id = registerPendingCopy({
                    workspaceRootAbs: root,
                    source_path: src,
                    dest_path: dst,
                    overwrite: ow,
                  });
                  return `PENDING_APPROVAL:${JSON.stringify({
                    id,
                    source_path: src,
                    dest_path: dst,
                    overwrite: ow,
                  })}`;
                }
                return await applyCopyWorkspaceFile(root, src, dst, ow);
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            },
            {
              name: 'copy_workspace_file',
              description:
                'Copy a regular file to another path under the workspace (creates parent directories). Directories are not supported. When AGENT_REQUIRE_APPROVAL_FOR_WRITES is set, requires user approval.',
              schema: z.object({
                source_path: z.string().describe('Source file path relative to workspace root'),
                dest_path: z.string().describe('Destination file path relative to workspace root'),
                overwrite: z
                  .boolean()
                  .optional()
                  .describe('If true, replace an existing file at dest_path (default false)'),
              }),
            }
          ),

          tool(
            async ({ source_path, dest_path, overwrite }) => {
              const src = source_path.trim();
              const dst = dest_path.trim();
              if (!src || !dst) return 'Refused: source_path and dest_path are required.';
              const blockMove = readBeforeWriteBlockedMessage(
                readTracker,
                root,
                src,
                'moving this file (read the source first)'
              );
              if (blockMove) return blockMove;
              const dirtyMS = clientWorkspaceDirtyBlockedMessage(dirty, root, src, 'moving (source has unsaved editor changes)');
              if (dirtyMS) return dirtyMS;
              const dirtyMD = clientWorkspaceDirtyBlockedMessage(dirty, root, dst, 'moving (destination has unsaved editor changes)');
              if (dirtyMD) return dirtyMD;
              try {
                const ow = overwrite === true;
                if (writesNeedApproval) {
                  const id = registerPendingMove({
                    workspaceRootAbs: root,
                    source_path: src,
                    dest_path: dst,
                    overwrite: ow,
                  });
                  return `PENDING_APPROVAL:${JSON.stringify({
                    id,
                    source_path: src,
                    dest_path: dst,
                    overwrite: ow,
                  })}`;
                }
                return await applyMoveWorkspaceFile(root, src, dst, ow);
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            },
            {
              name: 'move_workspace_file',
              description:
                'Move or rename a regular file under the workspace (creates parent directories for the destination). Directories are not supported. When AGENT_REQUIRE_APPROVAL_FOR_WRITES is set, requires user approval.',
              schema: z.object({
                source_path: z.string().describe('Source file path relative to workspace root'),
                dest_path: z.string().describe('Destination file path relative to workspace root'),
                overwrite: z
                  .boolean()
                  .optional()
                  .describe('If true, replace an existing file at dest_path (default false)'),
              }),
            }
          ),
        ]),
  ];
}
