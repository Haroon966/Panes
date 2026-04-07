import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  MAX_WORKSPACE_SKILL_FILES,
  buildWorkspaceSkillsPromptAppend,
  parseSkillMdFrontmatter,
} from './workspaceSkillsPrompt.js';

describe('parseSkillMdFrontmatter', () => {
  it('parses name and description', () => {
    const raw = `---
name: my-skill
description: Use when refactoring React components
---
# Body
hello
`;
    const p = parseSkillMdFrontmatter(raw);
    assert.ok(p);
    assert.equal(p!.name, 'my-skill');
    assert.equal(p!.description, 'Use when refactoring React components');
  });

  it('supports double-quoted values', () => {
    const raw = `---
name: "quoted"
description: "Short desc"
---
`;
    const p = parseSkillMdFrontmatter(raw);
    assert.ok(p);
    assert.equal(p!.name, 'quoted');
    assert.equal(p!.description, 'Short desc');
  });

  it('returns null when no YAML frontmatter', () => {
    assert.equal(parseSkillMdFrontmatter('# Just markdown'), null);
  });

  it('returns null when frontmatter is empty', () => {
    const raw = `---
---
# x
`;
    assert.equal(parseSkillMdFrontmatter(raw), null);
  });
});

describe('buildWorkspaceSkillsPromptAppend', () => {
  it('returns empty string when .cursor/skills is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tai-sk-'));
    const out = await buildWorkspaceSkillsPromptAppend(dir);
    assert.equal(out, '');
  });

  it('lists SKILL.md entries with workspace-relative paths', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tai-sk-'));
    const skillDir = path.join(dir, '.cursor', 'skills', 'demo-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---
name: Demo
description: Testing skills index
---
# Demo
`,
      'utf8'
    );
    const out = await buildWorkspaceSkillsPromptAppend(dir);
    assert.ok(out.includes('Workspace skills'));
    assert.ok(out.includes('Demo'));
    assert.ok(out.includes('Testing skills index'));
    assert.ok(out.includes('`.cursor/skills/demo-skill/SKILL.md`'));
    assert.ok(out.includes('read_workspace_file'));
  });

  it('uses directory name when frontmatter is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tai-sk-'));
    const skillDir = path.join(dir, '.cursor', 'skills', 'fallback-name');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# No frontmatter\n', 'utf8');
    const out = await buildWorkspaceSkillsPromptAppend(dir);
    assert.ok(out.includes('**fallback-name**'));
    assert.ok(out.includes('_(no description in frontmatter)_'));
  });

  it('caps listed files at MAX_WORKSPACE_SKILL_FILES', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tai-sk-'));
    const root = path.join(dir, '.cursor', 'skills');
    await fs.mkdir(root, { recursive: true });
    const n = MAX_WORKSPACE_SKILL_FILES + 6;
    for (let i = 0; i < n; i++) {
      const d = path.join(root, `skill-${i}`);
      await fs.mkdir(d, { recursive: true });
      await fs.writeFile(
        path.join(d, 'SKILL.md'),
        `---
name: S${i}
description: x
---
`,
        'utf8'
      );
    }
    const out = await buildWorkspaceSkillsPromptAppend(dir);
    const matches = out.match(/\*\*S\d+\*\*/g);
    assert.ok(matches);
    assert.equal(matches!.length, MAX_WORKSPACE_SKILL_FILES);
    assert.ok(out.includes('not listed'));
  });

  it('respects index character budget with an omitted footer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tai-sk-'));
    const root = path.join(dir, '.cursor', 'skills');
    await fs.mkdir(root, { recursive: true });
    const descBody = 'y'.repeat(500);
    const n = 30;
    for (let i = 0; i < n; i++) {
      const d = path.join(root, `bud-${i}`);
      await fs.mkdir(d, { recursive: true });
      await fs.writeFile(
        path.join(d, 'SKILL.md'),
        `---
name: Bud${i}
description: ${descBody}
---
`,
        'utf8'
      );
    }
    const out = await buildWorkspaceSkillsPromptAppend(dir);
    assert.ok(out.includes('not listed'));
    const listed = (out.match(/\*\*Bud\d+\*\*/g) ?? []).length;
    assert.ok(listed < n);
  });
});
