import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeAgentContextHints,
  normalizeAgentVerbosity,
  verbosityStyleBlock,
} from './agentStylePrefs.js';

describe('agentStylePrefs', () => {
  it('normalizes verbosity', () => {
    assert.equal(normalizeAgentVerbosity('concise'), 'concise');
    assert.equal(normalizeAgentVerbosity(''), 'detailed');
    assert.equal(normalizeAgentVerbosity('nope'), 'detailed');
  });

  it('truncates context hints', () => {
    const long = 'a'.repeat(5000);
    assert.equal(normalizeAgentContextHints(long).length, 4000);
  });

  it('verbosityStyleBlock returns non-empty for each mode', () => {
    for (const v of ['concise', 'detailed', 'step_by_step'] as const) {
      assert.ok(verbosityStyleBlock(v).includes('Response style'));
    }
  });
});
