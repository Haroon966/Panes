import path from 'node:path';
import fs from 'node:fs/promises';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';
import { MAX_READ_BYTES } from './workspaceTools';
import { registerPathReadForWriteGuard } from './workspaceReadBeforeWrite';
import { formatReadToolRedactionFootnote, redactLikelySecrets } from '../lib/agentSecretLeak';

const MAX_OUTLINE_ENTRIES_DEFAULT = 80;
const MAX_OUTLINE_ENTRIES_CAP = 200;

export type OutlineEntry = { line: number; kind: string; label: string };

type Rule = { re: RegExp; kind: string; labelGroup: number };

const TS_JS_RULES: Rule[] = [
  { re: /^\s*export\s+default\s+function\s+(\w+)/, kind: 'function', labelGroup: 1 },
  { re: /^\s*export\s+async\s+function\s+(\w+)/, kind: 'function', labelGroup: 1 },
  { re: /^\s*export\s+function\s+(\w+)/, kind: 'function', labelGroup: 1 },
  { re: /^\s*async\s+function\s+(\w+)/, kind: 'function', labelGroup: 1 },
  { re: /^\s*function\s+(\w+)/, kind: 'function', labelGroup: 1 },
  { re: /^\s*export\s+class\s+(\w+)/, kind: 'class', labelGroup: 1 },
  { re: /^\s*class\s+(\w+)/, kind: 'class', labelGroup: 1 },
  { re: /^\s*export\s+interface\s+(\w+)/, kind: 'interface', labelGroup: 1 },
  { re: /^\s*interface\s+(\w+)/, kind: 'interface', labelGroup: 1 },
  { re: /^\s*export\s+type\s+(\w+)\s*[<=]/, kind: 'type', labelGroup: 1 },
  { re: /^\s*type\s+(\w+)\s*[<=]/, kind: 'type', labelGroup: 1 },
  { re: /^\s*export\s+enum\s+(\w+)/, kind: 'enum', labelGroup: 1 },
  { re: /^\s*enum\s+(\w+)/, kind: 'enum', labelGroup: 1 },
  { re: /^\s*export\s+const\s+(\w+)\s*=/, kind: 'const', labelGroup: 1 },
];

const PY_RULES: Rule[] = [
  { re: /^\s*async\s+def\s+(\w+)\s*\(/, kind: 'function', labelGroup: 1 },
  { re: /^\s*def\s+(\w+)\s*\(/, kind: 'function', labelGroup: 1 },
  { re: /^\s*class\s+(\w+)\b/, kind: 'class', labelGroup: 1 },
];

const GO_RULES: Rule[] = [
  { re: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/, kind: 'func', labelGroup: 1 },
  { re: /^\s*type\s+(\w+)\s+struct\b/, kind: 'struct', labelGroup: 1 },
  { re: /^\s*type\s+(\w+)\s+interface\b/, kind: 'interface', labelGroup: 1 },
];

const RS_RULES: Rule[] = [
  { re: /^\s*pub\s+fn\s+(\w+)\s*\(/, kind: 'fn', labelGroup: 1 },
  { re: /^\s*fn\s+(\w+)\s*\(/, kind: 'fn', labelGroup: 1 },
  { re: /^\s*pub\s+struct\s+(\w+)/, kind: 'struct', labelGroup: 1 },
  { re: /^\s*struct\s+(\w+)/, kind: 'struct', labelGroup: 1 },
  { re: /^\s*pub\s+enum\s+(\w+)/, kind: 'enum', labelGroup: 1 },
  { re: /^\s*enum\s+(\w+)/, kind: 'enum', labelGroup: 1 },
  { re: /^\s*impl(?:<[^>{}]+>)?\s+(.+?)\s*(?:for\b|\{)/, kind: 'impl', labelGroup: 1 },
];

const MD_RULES: Rule[] = [
  { re: /^(#{1,6})\s+(.+)$/, kind: 'heading', labelGroup: 2 },
];

function rulesForExt(ext: string): Rule[] {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte'].includes(e)) return TS_JS_RULES;
  if (e === 'py' || e === 'pyi') return PY_RULES;
  if (e === 'go') return GO_RULES;
  if (e === 'rs') return RS_RULES;
  if (['md', 'mdx'].includes(e)) return MD_RULES;
  return TS_JS_RULES;
}

/** Exported for tests. */
export function extractWorkspaceFileOutline(
  source: string,
  filePathForExt: string,
  maxEntries: number
): OutlineEntry[] {
  const ext = path.extname(filePathForExt);
  const rules = rulesForExt(ext);
  const lines = source.split(/\n/);
  const out: OutlineEntry[] = [];
  const usedLines = new Set<number>();

  const cap = Math.min(MAX_OUTLINE_ENTRIES_CAP, Math.max(4, maxEntries));

  for (let i = 0; i < lines.length && out.length < cap; i++) {
    if (usedLines.has(i)) continue;
    const raw = lines[i];
    if (raw === undefined) continue;
    const t = raw.trim();
    if (!t) continue;
    for (const { re, kind, labelGroup } of rules) {
      const m = t.match(re);
      if (!m) continue;
      let label = m[labelGroup];
      if (label === undefined) break;
      if (kind === 'heading' && m[1]) {
        label = `${m[1]} ${label}`.trim();
      }
      label = label.trim().slice(0, 200);
      if (!label) break;
      out.push({ line: i + 1, kind, label });
      usedLines.add(i);
      break;
    }
  }

  return out;
}

function formatOutline(relPath: string, entries: OutlineEntry[]): string {
  if (entries.length === 0) {
    return `No outline entries for \`${relPath}\` (heuristic scan; try read_workspace_file or grep).`;
  }
  const lines = entries.map((e) => `L${e.line}\t${e.kind}\t${e.label}`);
  return `Heuristic outline for \`${relPath}\` (${entries.length} entries; not AST/LSP):\n${lines.join('\n')}`;
}

export function createOutlineWorkspaceTool(
  workspaceRootAbs: string,
  opts?: { workspaceReadPathsThisTurn?: Set<string> }
) {
  const root = path.resolve(workspaceRootAbs);
  const readTracker = opts?.workspaceReadPathsThisTurn;

  return [
    tool(
      async ({ relative_path, max_entries }) => {
        const rel = relative_path.trim();
        if (!rel) return 'Empty path.';
        let abs: string;
        try {
          abs = resolveWorkspaceFileAbs(root, rel);
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
        const st = await fs.stat(abs).catch(() => null);
        if (!st?.isFile()) return `Not a file: ${rel}`;
        if (st.size > MAX_READ_BYTES) {
          return `File too large for outline (${st.size} bytes; max ${MAX_READ_BYTES}).`;
        }
        const buf = await fs.readFile(abs, 'utf8');
        const max = Math.min(
          MAX_OUTLINE_ENTRIES_CAP,
          Math.max(8, max_entries ?? MAX_OUTLINE_ENTRIES_DEFAULT)
        );
        const entries = extractWorkspaceFileOutline(buf, rel, max);
        const displayRel = path.relative(root, abs) || rel;
        registerPathReadForWriteGuard(readTracker, root, rel);
        const formatted = formatOutline(displayRel.replace(/\\/g, '/'), entries);
        const { text, labels } = redactLikelySecrets(formatted);
        return `${text}${formatReadToolRedactionFootnote(labels)}`;
      },
      {
        name: 'get_workspace_file_outline',
        description:
          'Heuristic **file outline**: scans one workspace file line-by-line for common declarations (TS/JS class/function/interface/type/enum, Python def/class, Go func/type, Rust fn/struct/enum/impl, Markdown headings). **Not** an LSP/AST outline — may miss or mislabel entries. Use read_workspace_file for exact code.',
        schema: z.object({
          relative_path: z.string().min(1).max(512).describe('Workspace-relative file path'),
          max_entries: z
            .number()
            .optional()
            .describe(`Max outline rows (default ${MAX_OUTLINE_ENTRIES_DEFAULT}, max ${MAX_OUTLINE_ENTRIES_CAP})`),
        }),
      }
    ),
  ];
}
