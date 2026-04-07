import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rgEscapeRegexMetachars, wordBoundarySymbolPattern } from './symbolWorkspaceTools.js';

describe('symbolWorkspaceTools', () => {
  it('escapes regex metacharacters', () => {
    assert.equal(rgEscapeRegexMetachars('a.b'), 'a\\.b');
    assert.equal(rgEscapeRegexMetachars('x[y]'), 'x\\[y\\]');
  });

  it('builds word-boundary pattern', () => {
    assert.equal(wordBoundarySymbolPattern('foo'), '\\bfoo\\b');
    assert.equal(wordBoundarySymbolPattern('MyType'), '\\bMyType\\b');
    assert.equal(wordBoundarySymbolPattern('a.b'), '\\ba\\.b\\b');
  });

  it('returns empty for blank name', () => {
    assert.equal(wordBoundarySymbolPattern(''), '');
    assert.equal(wordBoundarySymbolPattern('   '), '');
  });
});
