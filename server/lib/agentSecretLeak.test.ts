import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatReadToolRedactionFootnote,
  formatSecretRedactionHint,
  redactLikelySecrets,
} from './agentSecretLeak.js';

describe('agentSecretLeak', () => {
  it('no-ops when scan disabled', () => {
    const prev = process.env.AGENT_DISABLE_SECRET_LEAK_SCAN;
    process.env.AGENT_DISABLE_SECRET_LEAK_SCAN = '1';
    try {
      const r = redactLikelySecrets('sk-12345678901234567890123456789012');
      assert.equal(r.text, 'sk-12345678901234567890123456789012');
      assert.equal(r.labels.length, 0);
    } finally {
      if (prev === undefined) delete process.env.AGENT_DISABLE_SECRET_LEAK_SCAN;
      else process.env.AGENT_DISABLE_SECRET_LEAK_SCAN = prev;
    }
  });

  it('redacts long OpenAI-style sk- key', () => {
    const raw = 'token=sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';
    const r = redactLikelySecrets(raw);
    assert.ok(!r.text.includes('sk-abc'));
    assert.ok(r.text.includes('[REDACTED:api_key]'));
    assert.ok(r.labels.some((l) => l.includes('OpenAI')));
  });

  it('redacts GitHub ghp_ token', () => {
    const raw = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD';
    const r = redactLikelySecrets(raw);
    assert.ok(!r.text.includes('ghp_'));
    assert.ok(r.labels.length >= 1);
  });

  it('formatSecretRedactionHint joins labels', () => {
    const h = formatSecretRedactionHint(['A', 'B']);
    assert.ok(h?.includes('A'));
    assert.ok(h?.includes('B'));
    assert.equal(formatSecretRedactionHint([]), undefined);
  });

  it('formatReadToolRedactionFootnote is empty without labels', () => {
    assert.equal(formatReadToolRedactionFootnote([]), '');
    assert.ok(formatReadToolRedactionFootnote(['X']).includes('X'));
  });
});
