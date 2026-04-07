import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLikelyWorkspaceRelativePath,
  parseWorkspacePathWithLine,
} from './workspacePathHeuristic.js';

describe('workspacePathHeuristic', () => {
  it('accepts typical repo-relative paths', () => {
    assert.equal(isLikelyWorkspaceRelativePath('src/App.tsx'), true);
    assert.equal(isLikelyWorkspaceRelativePath('server/index.ts'), true);
    assert.equal(isLikelyWorkspaceRelativePath('package.json'), true);
    assert.equal(isLikelyWorkspaceRelativePath('.env.example'), true);
  });

  it('rejects URLs and prose', () => {
    assert.equal(isLikelyWorkspaceRelativePath('https://a.com/b.ts'), false);
    assert.equal(isLikelyWorkspaceRelativePath('not a path'), false);
    assert.equal(isLikelyWorkspaceRelativePath('foo'), false);
  });

  it('parseWorkspacePathWithLine parses :line and #L', () => {
    assert.deepEqual(parseWorkspacePathWithLine('src/App.tsx:42'), {
      path: 'src/App.tsx',
      line: 42,
    });
    assert.deepEqual(parseWorkspacePathWithLine('server/index.ts#L10'), {
      path: 'server/index.ts',
      line: 10,
    });
    assert.deepEqual(parseWorkspacePathWithLine('pkg/foo.ts#99'), {
      path: 'pkg/foo.ts',
      line: 99,
    });
    assert.equal(parseWorkspacePathWithLine('src/App.tsx'), null);
    assert.equal(parseWorkspacePathWithLine('https://x/y:z'), null);
  });
});
