import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeFtsUserQuery } from './workspaceFtsIndexer.js';

describe('sanitizeFtsUserQuery', () => {
  it('returns empty for blank input', () => {
    assert.equal(sanitizeFtsUserQuery(''), '');
    assert.equal(sanitizeFtsUserQuery('   '), '');
  });

  it('quotes tokens and joins with OR', () => {
    assert.equal(sanitizeFtsUserQuery('foo bar'), '"foo" OR "bar"');
  });

  it('drops short tokens and strips punctuation inside words', () => {
    assert.equal(sanitizeFtsUserQuery('a xx hello'), '"xx" OR "hello"');
    assert.equal(sanitizeFtsUserQuery('hello, world!'), '"hello" OR "world"');
  });
});
