import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMcpConfigJson } from './mcpConfigParse.js';

test('parseMcpConfigJson accepts Cursor-style mcpServers', () => {
  const raw = JSON.stringify({
    mcpServers: {
      fs: { command: 'npx', args: ['-y', '@scope/pkg'] },
      empty: {},
    },
  });
  const r = parseMcpConfigJson(raw);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.servers.length, 2);
  assert.equal(r.servers[0]!.name, 'fs');
  assert.equal(r.servers[0]!.command, 'npx');
  assert.deepEqual(r.servers[0]!.args, ['-y', '@scope/pkg']);
  assert.equal(r.servers[1]!.name, 'empty');
});

test('parseMcpConfigJson rejects invalid JSON', () => {
  const r = parseMcpConfigJson('{');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.length > 0);
});

test('parseMcpConfigJson rejects missing mcpServers', () => {
  const r = parseMcpConfigJson('{}');
  assert.equal(r.ok, false);
});

test('parseMcpConfigJson allows empty mcpServers', () => {
  const r = parseMcpConfigJson('{"mcpServers":{}}');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.servers, []);
});
