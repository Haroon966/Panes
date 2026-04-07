import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';

/** Max SKILL.md files listed in one agent run. */
export const MAX_WORKSPACE_SKILL_FILES = 32;
/** Max directory depth under `.cursor/skills` (skill-dir nesting). */
export const MAX_SKILLS_WALK_DEPTH = 14;
/** Bytes read from each file for frontmatter parsing only. */
export const SKILL_MD_HEAD_BYTES = 24_000;
/** Max characters for the entire skills index section (paths + descriptions). */
export const MAX_SKILLS_INDEX_CHARS = 12_000;
/** Truncate long descriptions in the index (full text is still in SKILL.md). */
export const MAX_SKILL_DESC_DISPLAY_CHARS = 400;

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.hg', '.svn']);

export type ParsedSkillFrontmatter = {
  name: string;
  description: string;
};

/**
 * Parse YAML frontmatter from the start of a SKILL.md (name + description).
 * Supports simple `key: value` lines; description may be a quoted string.
 */
export function parseSkillMdFrontmatter(raw: string): ParsedSkillFrontmatter | null {
  const trimmed = raw.replace(/^\uFEFF/, '');
  const m = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const block = m[1];
  let name = '';
  let description = '';
  for (const line of block.split(/\r?\n/)) {
    const nm = line.match(/^\s*name:\s*(.+)\s*$/);
    if (nm) {
      name = unquoteYamlScalar(nm[1].trim());
      continue;
    }
    const dm = line.match(/^\s*description:\s*(.+)\s*$/);
    if (dm) {
      description = unquoteYamlScalar(dm[1].trim());
      continue;
    }
  }
  if (!name && !description) return null;
  return { name, description };
}

function unquoteYamlScalar(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function isUnderWorkspaceRoot(workspaceRootAbs: string, absFile: string): boolean {
  const root = path.resolve(workspaceRootAbs);
  const file = path.resolve(absFile);
  const rel = path.relative(root, file);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function absToWorkspaceRel(workspaceRootAbs: string, absFile: string): string {
  const rel = path.relative(path.resolve(workspaceRootAbs), path.resolve(absFile));
  return rel.replace(/\\/g, '/');
}

async function walkSkillMdFiles(
  dir: string,
  depth: number,
  out: string[],
  excessSkillMd: { n: number }
): Promise<void> {
  if (depth > MAX_SKILLS_WALK_DEPTH) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      await walkSkillMdFiles(full, depth + 1, out, excessSkillMd);
    } else if (e.isFile() && e.name === 'SKILL.md') {
      if (out.length < MAX_WORKSPACE_SKILL_FILES) {
        out.push(full);
      } else {
        excessSkillMd.n += 1;
      }
    }
  }
}

/**
 * Reads discovered SKILL.md heads and returns a markdown block for the system prompt.
 * Best-effort: skips unreadable paths; truncates when over budget.
 */
export async function buildWorkspaceSkillsPromptAppend(workspaceRootAbs: string): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const skillsRoot = path.join(root, '.cursor', 'skills');
  const skillAbsPaths: string[] = [];
  const excessSkillMd = { n: 0 };
  try {
    const st = await fs.stat(skillsRoot);
    if (!st.isDirectory()) return '';
  } catch {
    return '';
  }

  await walkSkillMdFiles(skillsRoot, 0, skillAbsPaths, excessSkillMd);
  skillAbsPaths.sort((a, b) => a.localeCompare(b));

  const rows: string[] = [];
  let totalChars = 0;
  let omitted = excessSkillMd.n;

  for (let i = 0; i < skillAbsPaths.length; i++) {
    const abs = skillAbsPaths[i];
    if (!isUnderWorkspaceRoot(root, abs)) continue;
    let rel: string;
    try {
      rel = absToWorkspaceRel(root, abs);
      resolveWorkspaceFileAbs(root, rel);
    } catch {
      omitted++;
      continue;
    }

    let head: string;
    try {
      const fh = await fs.open(abs, 'r');
      try {
        const buf = Buffer.alloc(Math.min(SKILL_MD_HEAD_BYTES, 1024 * 1024));
        const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
        head = buf.slice(0, bytesRead).toString('utf8');
      } finally {
        await fh.close();
      }
    } catch {
      omitted++;
      continue;
    }

    const parsed = parseSkillMdFrontmatter(head);
    const skillDirName = path.basename(path.dirname(abs));
    let displayName = parsed?.name?.trim() || skillDirName;
    if (displayName.length > 120) displayName = `${displayName.slice(0, 117)}…`;
    let displayDesc = parsed?.description?.trim() || '_(no description in frontmatter)_';
    if (displayDesc.length > MAX_SKILL_DESC_DISPLAY_CHARS) {
      displayDesc = `${displayDesc.slice(0, MAX_SKILL_DESC_DISPLAY_CHARS)}…`;
    }

    const line = `- **${displayName}** — ${displayDesc}\n  - Path: \`${rel}\``;
    const projected = totalChars + line.length + (rows.length > 0 ? 2 : 0);
    if (projected > MAX_SKILLS_INDEX_CHARS) {
      omitted += skillAbsPaths.length - i;
      break;
    }
    rows.push(line);
    totalChars = projected;
  }

  if (rows.length === 0) return '';

  const more =
    omitted > 0 ? `\n\n_${omitted} skill file(s) not listed (budget, unreadable, or skipped)._` : '';

  return [
    '## Workspace skills (Cursor-style)',
    'These are **SKILL.md** entries under `.cursor/skills/`. When the user’s task matches a skill’s description, call **read_workspace_file** on that path **first**, then follow the skill’s instructions for that work.',
    '',
    ...rows,
    more,
  ]
    .filter((x) => x !== '')
    .join('\n');
}
