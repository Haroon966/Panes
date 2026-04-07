import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHAT_MESSAGES_REQUIRED,
  getChatMessagesValidationError,
} from './agentRequestShared.js';

describe('getChatMessagesValidationError', () => {
  it('returns null for a valid non-empty array', () => {
    assert.equal(
      getChatMessagesValidationError([
        { role: 'system', content: 'x' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'yo' },
      ]),
      null
    );
  });

  it('returns CHAT_MESSAGES_REQUIRED when missing or empty', () => {
    assert.equal(getChatMessagesValidationError(undefined), CHAT_MESSAGES_REQUIRED);
    assert.equal(getChatMessagesValidationError(null), CHAT_MESSAGES_REQUIRED);
    assert.equal(getChatMessagesValidationError([]), CHAT_MESSAGES_REQUIRED);
  });

  it('rejects non-object message entries', () => {
    assert.ok(getChatMessagesValidationError(['x']));
    assert.ok(getChatMessagesValidationError([null]));
  });

  it('rejects invalid role', () => {
    const err = getChatMessagesValidationError([{ role: 'tool', content: 'x' }]);
    assert.ok(err?.includes('role'));
  });

  it('rejects non-string content', () => {
    const err = getChatMessagesValidationError([{ role: 'user', content: 1 } as unknown]);
    assert.ok(err?.includes('content'));
  });
});
