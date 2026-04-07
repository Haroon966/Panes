import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitDocText } from './readDocsTool.js';

describe('readDocsTool chunking', () => {
  it('returns empty array for empty string', () => {
    assert.deepEqual(splitDocText('', 100, 10), []);
  });

  it('returns single chunk when text fits', () => {
    const t = 'hello world';
    assert.deepEqual(splitDocText(t, 100, 10), [t]);
  });

  it('splits with overlap', () => {
    const t = 'a'.repeat(50);
    const chunks = splitDocText(t, 20, 5);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks[0]!.length <= 20);
    assert.ok(chunks.join('').length >= t.length - 5);
  });

  it('last chunk ends at document end', () => {
    const t = '0123456789'.repeat(10);
    const chunks = splitDocText(t, 25, 5);
    assert.equal(chunks[chunks.length - 1]!.endsWith('9'), true);
    assert.equal(chunks[0]!.startsWith('0'), true);
  });
});
