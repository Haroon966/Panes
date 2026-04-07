import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildClientWorkspaceDirtyPathSet,
  clientWorkspaceDirtyBlockedMessage,
  sanitizeClientWorkspaceDirtyPaths,
} from './workspaceClientDirtyPaths.js';

describe('workspaceClientDirtyPaths', () => {
  it('sanitizeClientWorkspaceDirtyPaths trims and caps', () => {
    assert.deepEqual(sanitizeClientWorkspaceDirtyPaths(undefined), []);
    assert.deepEqual(sanitizeClientWorkspaceDirtyPaths('x'), []);
    const many = Array.from({ length: 70 }, (_, i) => `f${i}.ts`);
    const s = sanitizeClientWorkspaceDirtyPaths(many);
    assert.equal(s.length, 64);
    assert.equal(s[0], 'f0.ts');
  });

  it('clientWorkspaceDirtyBlockedMessage matches canonical keys', () => {
    const root = path.resolve('/tmp/ws');
    const dirty = buildClientWorkspaceDirtyPathSet(root, ['src/a.ts']);
    const msg = clientWorkspaceDirtyBlockedMessage(dirty, root, 'src/a.ts', 'writing');
    assert.ok(msg?.includes('unsaved'));
    assert.equal(clientWorkspaceDirtyBlockedMessage(dirty, root, 'src/b.ts', 'writing'), null);
  });
});
