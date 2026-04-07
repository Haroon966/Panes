import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkspaceTools } from './workspaceTools.js';

describe('read_workspace_file secret redaction', () => {
  let root: string;
  const secretLine = 'key=sk-12345678901234567890123456789012';

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'terminalai-readredact-'));
    await fs.writeFile(path.join(root, 'secrets.txt'), `${secretLine}\n`, 'utf8');
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('redacts likely secrets in full-file read', async () => {
    const tools = createWorkspaceTools(root);
    const readTool = tools.find((t) => t.name === 'read_workspace_file');
    assert.ok(readTool);
    const out = (await readTool.invoke({ relative_path: 'secrets.txt' })) as string;
    assert.ok(out.includes('[REDACTED:api_key]'));
    assert.ok(!out.includes(secretLine));
    assert.match(out, /\[Server note:.*redacted/);
  });

  it('redacts in line-slice read', async () => {
    const tools = createWorkspaceTools(root);
    const readTool = tools.find((t) => t.name === 'read_workspace_file');
    assert.ok(readTool);
    const out = (await readTool.invoke({
      relative_path: 'secrets.txt',
      start_line: 1,
      end_line: 1,
    })) as string;
    assert.ok(out.includes('[REDACTED:api_key]'));
    assert.ok(!out.includes(secretLine));
  });

  it('skips redaction when AGENT_DISABLE_SECRET_LEAK_SCAN is set', async () => {
    const prev = process.env.AGENT_DISABLE_SECRET_LEAK_SCAN;
    process.env.AGENT_DISABLE_SECRET_LEAK_SCAN = '1';
    try {
      const tools = createWorkspaceTools(root);
      const readTool = tools.find((t) => t.name === 'read_workspace_file');
      assert.ok(readTool);
      const out = (await readTool.invoke({ relative_path: 'secrets.txt' })) as string;
      assert.ok(out.includes(secretLine));
      assert.ok(!out.includes('[Server note:'));
    } finally {
      if (prev === undefined) delete process.env.AGENT_DISABLE_SECRET_LEAK_SCAN;
      else process.env.AGENT_DISABLE_SECRET_LEAK_SCAN = prev;
    }
  });
});
