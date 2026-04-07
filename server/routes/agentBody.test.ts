import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAgentPostBodyValidationError } from './agent.js';

describe('getAgentPostBodyValidationError', () => {
  it('returns null for a valid body shape', () => {
    assert.equal(
      getAgentPostBodyValidationError({
        messages: [{ role: 'user', content: 'hi' }],
        provider: 'openai',
        model: 'gpt-4o',
      }),
      null
    );
  });

  it('rejects missing messages', () => {
    assert.ok(getAgentPostBodyValidationError({ provider: 'openai', model: 'x' }));
  });

  it('rejects empty model string', () => {
    assert.ok(
      getAgentPostBodyValidationError({
        messages: [{ role: 'user', content: 'hi' }],
        provider: 'openai',
        model: '',
      })
    );
  });

  it('rejects invalid message role with a specific error', () => {
    const err = getAgentPostBodyValidationError({
      messages: [{ role: 'invalid', content: 'hi' }],
      provider: 'openai',
      model: 'gpt-4o',
    } as unknown);
    assert.ok(err?.includes('role'));
  });

  it('rejects non-string message content', () => {
    const err = getAgentPostBodyValidationError({
      messages: [{ role: 'user', content: 1 }],
      provider: 'openai',
      model: 'gpt-4o',
    } as unknown);
    assert.ok(err?.includes('content'));
  });
});
