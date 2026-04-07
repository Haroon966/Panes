import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeAgentTraceJson, parseAgentTraceColumn } from './agentTraceJson.js';

describe('agentTraceJson', () => {
  it('normalizes invalid JSON to empty array string', () => {
    assert.equal(normalizeAgentTraceJson('not json'), '[]');
  });

  it('round-trips a valid trace and caps long previews', () => {
    const long = 'x'.repeat(20_000);
    const raw = JSON.stringify([
      { kind: 'graph_phase', phase: 'model' },
      {
        kind: 'tool',
        callId: 'c1',
        toolName: 'read_workspace_file',
        phase: 'done',
        preview: long,
      },
    ]);
    const n = normalizeAgentTraceJson(raw);
    const rows = parseAgentTraceColumn(n);
    assert.equal(rows.length, 2);
    const tool = rows[1]!;
    assert.equal(tool.kind, 'tool');
    if (tool.kind === 'tool') {
      assert.ok((tool.preview?.length ?? 0) < long.length);
      assert.ok(tool.preview?.includes('truncated'));
    }
  });
});
