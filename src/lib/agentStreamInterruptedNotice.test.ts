import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  AGENT_STREAM_INTERRUPTED_KEY,
  clearAgentStreamInterruptedNotice,
  readAgentStreamInterruptedNotice,
  recordAgentStreamInterrupted,
} from './agentStreamInterruptedNotice.js';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  (globalThis as unknown as { sessionStorage: typeof mock }).sessionStorage = mock;
});

test('readAgentStreamInterruptedNotice returns null when empty', () => {
  clearAgentStreamInterruptedNotice();
  assert.equal(readAgentStreamInterruptedNotice(), null);
});

test('record + read round-trip', () => {
  clearAgentStreamInterruptedNotice();
  recordAgentStreamInterrupted('conv-1');
  const n = readAgentStreamInterruptedNotice();
  assert.ok(n);
  assert.equal(n!.conversationId, 'conv-1');
  assert.ok(typeof n!.at === 'number');
  clearAgentStreamInterruptedNotice();
});

test('clear removes key', () => {
  recordAgentStreamInterrupted('x');
  clearAgentStreamInterruptedNotice();
  assert.equal(store.get(AGENT_STREAM_INTERRUPTED_KEY), undefined);
});
