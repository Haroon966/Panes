import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runWorkspaceContentGrep } from './workspaceGrepTool';

const MAX_SYMBOL_LEN = 200;

/** Escape user input for use inside a ripgrep Rust-regex pattern (after outer word boundaries). */
export function rgEscapeRegexMetachars(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]]/g, '\\$&');
}

/** Exported for tests. */
export function wordBoundarySymbolPattern(name: string): string {
  const t = name.trim();
  if (!t) return '';
  return `\\b${rgEscapeRegexMetachars(t)}\\b`;
}

export function createSymbolWorkspaceTools(workspaceRootAbs: string) {
  const root = path.resolve(workspaceRootAbs);

  return [
    tool(
      async ({ name, glob, max_line_hits }) => {
        const n = name.trim();
        if (!n) return 'Empty symbol name.';
        const pat = wordBoundarySymbolPattern(n);
        if (!pat) return 'Empty symbol name.';
        return runWorkspaceContentGrep(root, pat, {
          fixed_string: false,
          glob,
          max_line_hits,
          resultLabel: `Symbol “${n}” (word-boundary text search)`,
        });
      },
      {
        name: 'find_workspace_symbol',
        description:
          'Locate a **symbol by name** using ripgrep with **ASCII-style word boundaries** (\\b). Not AST/LSP: misses some unicode identifiers and cannot distinguish declarations from uses. Prefer **glob** (e.g. "*.ts") to narrow scope. Same excludes as grep_workspace_content.',
        schema: z.object({
          name: z.string().min(1).max(MAX_SYMBOL_LEN).describe('Identifier to find (e.g. MyClass, handleSubmit)'),
          glob: z
            .string()
            .optional()
            .describe('Optional path glob, e.g. "*.ts" or "*.{ts,tsx}"'),
          max_line_hits: z
            .number()
            .optional()
            .describe('Max lines (default 120, max 500)'),
        }),
      }
    ),
    tool(
      async ({ symbol, glob, max_line_hits }) => {
        const n = symbol.trim();
        if (!n) return 'Empty symbol.';
        const pat = wordBoundarySymbolPattern(n);
        if (!pat) return 'Empty symbol.';
        return runWorkspaceContentGrep(root, pat, {
          fixed_string: false,
          glob,
          max_line_hits: max_line_hits ?? 160,
          resultLabel: `References to “${n}” (word-boundary text search)`,
        });
      },
      {
        name: 'find_workspace_references',
        description:
          'Find **textual references** to a symbol (same word-boundary ripgrep as find_workspace_symbol, default returns a few more lines). Not true “find references” from a type checker — use for quick occurrence scans; combine with read_workspace_file on interesting paths.',
        schema: z.object({
          symbol: z.string().min(1).max(MAX_SYMBOL_LEN).describe('Symbol / identifier to search for'),
          glob: z
            .string()
            .optional()
            .describe('Optional path glob, e.g. "*.ts"'),
          max_line_hits: z
            .number()
            .optional()
            .describe('Max lines (default 160, max 500)'),
        }),
      }
    ),
  ];
}
