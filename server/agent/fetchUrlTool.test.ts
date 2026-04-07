import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hostAllowedForFetch,
  htmlToPlainText,
  isPrivateOrLocalHost,
  validateUrlForFetch,
} from './fetchUrlTool.js';

describe('fetchUrlTool guards', () => {
  it('rejects non-https', () => {
    const r = validateUrlForFetch('http://example.com/');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /https/i);
  });

  it('rejects private IPs', () => {
    assert.equal(isPrivateOrLocalHost('127.0.0.1'), true);
    assert.equal(isPrivateOrLocalHost('10.0.0.1'), true);
    assert.equal(isPrivateOrLocalHost('192.168.1.1'), true);
    const r = validateUrlForFetch('https://127.0.0.1/foo');
    assert.equal(r.ok, false);
  });

  it('allows MDN and rejects random host without env', () => {
    assert.equal(hostAllowedForFetch('developer.mozilla.org'), true);
    assert.equal(hostAllowedForFetch('evil.example'), false);
    const ok = validateUrlForFetch('https://developer.mozilla.org/en-US/docs/Web/JavaScript');
    assert.equal(ok.ok, true);
    const bad = validateUrlForFetch('https://evil.example/');
    assert.equal(bad.ok, false);
  });

  it('respects AGENT_FETCH_URL_ALLOWLIST', () => {
    const prev = process.env.AGENT_FETCH_URL_ALLOWLIST;
    process.env.AGENT_FETCH_URL_ALLOWLIST = 'example.org';
    try {
      assert.equal(hostAllowedForFetch('example.org'), true);
      const r = validateUrlForFetch('https://example.org/doc');
      assert.equal(r.ok, true);
    } finally {
      if (prev === undefined) delete process.env.AGENT_FETCH_URL_ALLOWLIST;
      else process.env.AGENT_FETCH_URL_ALLOWLIST = prev;
    }
  });

  it('strips HTML to plain text', () => {
    const html = '<html><head><style>body{}</style></head><body><p>Hi &amp; <b>there</b></p><script>x</script></body>';
    const t = htmlToPlainText(html);
    assert.match(t, /Hi & there/i);
    assert.ok(!t.includes('<script'));
  });
});
