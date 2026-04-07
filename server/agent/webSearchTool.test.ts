import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flattenDdgRelatedTopics, formatDuckDuckGoJson } from './webSearchTool.js';

describe('webSearchTool', () => {
  it('formats DuckDuckGo JSON with abstract and related', () => {
    const data = {
      Heading: 'TypeScript',
      AbstractText: 'A typed superset of JavaScript.',
      AbstractURL: 'https://www.typescriptlang.org/',
      RelatedTopics: [
        { Text: 'JavaScript programming language', FirstURL: 'https://example.com/js' },
        { Topics: [{ Text: 'Nested topic', FirstURL: 'https://example.com/n' }] },
      ],
    };
    const s = formatDuckDuckGoJson(data, 'typescript');
    assert.match(s, /TypeScript/i);
    assert.match(s, /typed superset/i);
    assert.match(s, /typescriptlang/i);
    assert.match(s, /JavaScript programming/);
    assert.match(s, /Nested topic/);
  });

  it('returns fallback when payload is empty', () => {
    const s = formatDuckDuckGoJson({ Heading: '', RelatedTopics: [] }, 'xyzabc123nonexistent');
    assert.match(s, /No instant answer/i);
  });

  it('flattens nested RelatedTopics with cap', () => {
    const out: { text: string; url: string }[] = [];
    flattenDdgRelatedTopics(
      [{ Topics: [{ Text: 'a', FirstURL: 'u1' }, { Text: 'b', FirstURL: 'u2' }] }],
      out,
      1
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]!.text, 'a');
  });
});
