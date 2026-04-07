import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { resolveWorkspaceFileAbs } from './workspacePathSandbox.js';

describe('resolveWorkspaceFileAbs', () => {
  const root = path.resolve('/workspace/project');

  it('resolves a normal relative path under root', () => {
    const abs = resolveWorkspaceFileAbs(root, 'src/index.ts');
    assert.equal(abs, path.join(root, 'src/index.ts'));
  });

  it('strips leading .. so a ..-prefixed relative path stays under root (matches sandbox rules)', () => {
    const abs = resolveWorkspaceFileAbs(root, '../outside/secret.txt');
    assert.equal(abs, path.join(root, 'outside/secret.txt'));
  });

  it('rejects absolute paths that escape', () => {
    assert.throws(() => resolveWorkspaceFileAbs(root, '/etc/passwd'), /escapes workspace root/);
  });

  it('strips leading .. segments per normalize rules', () => {
    const abs = resolveWorkspaceFileAbs(root, 'foo/../../src/a.ts');
    assert.equal(abs, path.join(root, 'src/a.ts'));
  });

  it('treats empty path as .', () => {
    const abs = resolveWorkspaceFileAbs(root, '');
    assert.equal(abs, root);
  });
});
