import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAgentStreamRetryableStatus } from './agentStreamFetch.js';

describe('agentStreamFetch', () => {
  it('marks transient upstream / rate-limit statuses as retryable', () => {
    assert.equal(isAgentStreamRetryableStatus(429), true);
    assert.equal(isAgentStreamRetryableStatus(502), true);
    assert.equal(isAgentStreamRetryableStatus(503), true);
    assert.equal(isAgentStreamRetryableStatus(504), true);
    assert.equal(isAgentStreamRetryableStatus(408), true);
  });

  it('does not retry client errors', () => {
    assert.equal(isAgentStreamRetryableStatus(400), false);
    assert.equal(isAgentStreamRetryableStatus(401), false);
    assert.equal(isAgentStreamRetryableStatus(404), false);
  });
});
