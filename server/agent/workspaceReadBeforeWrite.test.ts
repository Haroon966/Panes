import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  canonicalReadBeforeWriteKey,
  readBeforeWriteBlockedMessage,
  registerPathReadForWriteGuard,
} from './workspaceReadBeforeWrite.js';

describe('workspaceReadBeforeWrite', () => {
  it('canonicalReadBeforeWriteKey normalizes to forward slashes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'terminalai-rbw-'));
    try {
      await fs.mkdir(path.join(root, 'src'), { recursive: true });
      await fs.writeFile(path.join(root, 'src', 'a.ts'), '//x', 'utf8');
      const k = canonicalReadBeforeWriteKey(root, 'src/a.ts');
      assert.equal(k.includes('\\'), false);
      assert.ok(k.endsWith('a.ts'));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('register + block respects tracker when AGENT_ENFORCE_READ_BEFORE_WRITE', async () => {
    const prev = process.env.AGENT_ENFORCE_READ_BEFORE_WRITE;
    process.env.AGENT_ENFORCE_READ_BEFORE_WRITE = '1';
    const prevRo = process.env.AGENT_READ_ONLY;
    delete process.env.AGENT_READ_ONLY;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'terminalai-rbw2-'));
    try {
      const tracker = new Set<string>();
      const msg0 = readBeforeWriteBlockedMessage(tracker, root, 'f.txt', 'patching');
      assert.ok(msg0 && msg0.includes('Refused'));

      registerPathReadForWriteGuard(tracker, root, 'f.txt');
      const msg1 = readBeforeWriteBlockedMessage(tracker, root, 'f.txt', 'patching');
      assert.equal(msg1, null);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      if (prev === undefined) delete process.env.AGENT_ENFORCE_READ_BEFORE_WRITE;
      else process.env.AGENT_ENFORCE_READ_BEFORE_WRITE = prev;
      if (prevRo === undefined) delete process.env.AGENT_READ_ONLY;
      else process.env.AGENT_READ_ONLY = prevRo;
    }
  });
});
