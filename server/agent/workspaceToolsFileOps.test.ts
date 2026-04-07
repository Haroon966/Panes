import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  applyCopyWorkspaceFile,
  applyDeleteWorkspaceFile,
  applyMoveWorkspaceFile,
} from './workspaceTools.js';

describe('workspace file delete/copy/move', () => {
  let root: string;

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'terminalai-ws-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('deletes a file', async () => {
    const f = path.join(root, 'a.txt');
    await fs.writeFile(f, 'hi', 'utf8');
    const msg = await applyDeleteWorkspaceFile(root, 'a.txt', false);
    assert.match(msg, /Deleted file/);
    await assert.rejects(fs.stat(f));
  });

  it('deletes an empty directory when allowed', async () => {
    const d = path.join(root, 'emptydir');
    await fs.mkdir(d, { recursive: true });
    const msg = await applyDeleteWorkspaceFile(root, 'emptydir', true);
    assert.match(msg, /Deleted empty directory/);
    await assert.rejects(fs.stat(d));
  });

  it('refuses non-empty directory', async () => {
    const d = path.join(root, 'full');
    await fs.mkdir(path.join(d, 'nested'), { recursive: true });
    await assert.rejects(
      () => applyDeleteWorkspaceFile(root, 'full', true),
      /ENOTEMPTY|directory is not empty/i
    );
  });

  it('copies a file', async () => {
    await fs.writeFile(path.join(root, 's.txt'), 'abc', 'utf8');
    const msg = await applyCopyWorkspaceFile(root, 's.txt', 't.txt', false);
    assert.match(msg, /Copied/);
    assert.equal(await fs.readFile(path.join(root, 't.txt'), 'utf8'), 'abc');
  });

  it('moves a file', async () => {
    await fs.writeFile(path.join(root, 'm1.txt'), 'x', 'utf8');
    const msg = await applyMoveWorkspaceFile(root, 'm1.txt', 'm2.txt', false);
    assert.match(msg, /Moved/);
    assert.equal(await fs.readFile(path.join(root, 'm2.txt'), 'utf8'), 'x');
    await assert.rejects(fs.stat(path.join(root, 'm1.txt')));
  });
});
