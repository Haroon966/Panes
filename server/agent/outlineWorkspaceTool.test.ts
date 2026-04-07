import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractWorkspaceFileOutline } from './outlineWorkspaceTool.js';

describe('outlineWorkspaceTool', () => {
  it('extracts TS-style declarations', () => {
    const src = `// x
export function foo() {}
class Bar {}
interface Baz {}
type Q = number
`;
    const e = extractWorkspaceFileOutline(src, 'a.ts', 50);
    const labels = e.map((x) => `${x.line}:${x.kind}:${x.label}`);
    assert.ok(labels.some((l) => l.includes('function:foo')));
    assert.ok(labels.some((l) => l.includes('class:Bar')));
    assert.ok(labels.some((l) => l.includes('interface:Baz')));
    assert.ok(labels.some((l) => l.includes('type:Q')));
  });

  it('extracts Python defs and classes', () => {
    const src = `def a():
    pass
class B:
    pass
async def c():
    pass
`;
    const e = extractWorkspaceFileOutline(src, 'm.py', 50);
    assert.ok(e.some((x) => x.label === 'a' && x.kind === 'function'));
    assert.ok(e.some((x) => x.label === 'B' && x.kind === 'class'));
    assert.ok(e.some((x) => x.label === 'c' && x.kind === 'function'));
  });

  it('extracts markdown headings', () => {
    const src = '# Title\n\n## Sub\n';
    const e = extractWorkspaceFileOutline(src, 'r.md', 20);
    assert.ok(e.some((x) => x.kind === 'heading' && x.label.includes('Title')));
    assert.ok(e.some((x) => x.kind === 'heading' && x.label.includes('Sub')));
  });
});
