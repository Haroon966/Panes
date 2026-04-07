import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspaceFileAbs } from '../lib/workspacePathSandbox';

const MAX_PINNED_FILES = 8;
const MAX_CHARS_PER_FILE = 100_000;
const MAX_TOTAL_CHARS = 320_000;

/**
 * Reads pinned workspace files and returns a markdown block for the system prompt.
 * Best-effort: skips missing paths and truncates large files.
 */
export async function buildPinnedFilesPromptAppend(
  workspaceRootAbs: string,
  relativePaths: string[]
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const unique = [...new Set(relativePaths.map((p) => p.trim().replace(/\\/g, '/')).filter(Boolean))].slice(
    0,
    MAX_PINNED_FILES
  );
  if (unique.length === 0) return '';

  const sections: string[] = [];
  let totalChars = 0;

  for (const rel of unique) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    try {
      const abs = resolveWorkspaceFileAbs(root, rel);
      const st = await fs.stat(abs);
      if (!st.isFile()) {
        sections.push(`### ${rel}\n_(not a regular file)_`);
        continue;
      }
      const raw = await fs.readFile(abs, 'utf8');
      const room = MAX_TOTAL_CHARS - totalChars;
      const perCap = Math.min(MAX_CHARS_PER_FILE, room - 200);
      if (perCap < 200) break;
      let body = raw;
      let suffix = '';
      if (body.length > perCap) {
        body = body.slice(0, perCap);
        suffix = '\n… [truncated for pinned context budget]';
      }
      const block = `### ${rel}\n\`\`\`text\n${body}${suffix}\n\`\`\``;
      sections.push(block);
      totalChars += block.length;
    } catch {
      sections.push(`### ${rel}\n_(unreadable or outside workspace)_`);
    }
  }

  if (sections.length === 0) return '';

  return [
    '## User-pinned workspace files',
    'The user asked to always include these paths. Contents are a UTF-8 snapshot from the start of this request (may be truncated).',
    '',
    ...sections,
  ].join('\n');
}
