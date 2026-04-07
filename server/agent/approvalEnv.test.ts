import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentReadOnlyMode } from './approvalEnv.js';

describe('approvalEnv', () => {
  it('agentReadOnlyMode respects AGENT_READ_ONLY', () => {
    const prev = process.env.AGENT_READ_ONLY;
    try {
      delete process.env.AGENT_READ_ONLY;
      assert.equal(agentReadOnlyMode(), false);
      process.env.AGENT_READ_ONLY = '1';
      assert.equal(agentReadOnlyMode(), true);
      process.env.AGENT_READ_ONLY = 'true';
      assert.equal(agentReadOnlyMode(), true);
      process.env.AGENT_READ_ONLY = '0';
      assert.equal(agentReadOnlyMode(), false);
    } finally {
      if (prev === undefined) delete process.env.AGENT_READ_ONLY;
      else process.env.AGENT_READ_ONLY = prev;
    }
  });
});
