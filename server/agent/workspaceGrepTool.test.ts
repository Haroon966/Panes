import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_GREP_SECRET_ENV_BASENAMES,
  workspaceGrepRipgrepExcludeGlobs,
} from './workspaceGrepTool.js';

test('workspaceGrepRipgrepExcludeGlobs skips noisy dirs and secret env basenames', () => {
  const globs = workspaceGrepRipgrepExcludeGlobs();
  assert.ok(globs.includes('!**/node_modules/**'));
  assert.ok(globs.includes('!**/.git/**'));
  assert.ok(globs.includes('!**/.env'));
  assert.ok(globs.includes('!**/.env.local'));
  assert.ok(!globs.some((g) => g.includes('.env.example')));
});

test('WORKSPACE_GREP_SECRET_ENV_BASENAMES lists only secret-style .env* basenames', () => {
  assert.ok(WORKSPACE_GREP_SECRET_ENV_BASENAMES.length >= 1);
  assert.ok(WORKSPACE_GREP_SECRET_ENV_BASENAMES.every((b) => b.startsWith('.env')));
});
