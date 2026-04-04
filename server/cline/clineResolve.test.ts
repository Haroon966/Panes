import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  getClineUpstreamKind,
  getResolvedBaseHostHint,
  resolveClineBaseUrl,
  resolveClineUpstreamModel,
} from './clineStream';

describe('cline URL + model resolution', () => {
  const envSnapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      'CLINE_LOCAL_BASE_URL',
      'GROQ_OPENAI_BASE_URL',
      'OLLAMA_BASE_URL',
      'LMSTUDIO_BASE_URL',
      'CLINE_DEFAULT_MODEL',
      'GROQ_DEFAULT_MODEL',
      'OLLAMA_MODEL',
    ]) {
      envSnapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(envSnapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('resolveClineBaseUrl prefers body over env chain', () => {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    assert.strictEqual(resolveClineBaseUrl('http://example.com:9'), 'http://example.com:9');
  });

  it('resolveClineBaseUrl uses DB when body empty', () => {
    assert.strictEqual(resolveClineBaseUrl(undefined, 'http://db-only:99'), 'http://db-only:99');
  });

  it('resolveClineBaseUrl prefers body over DB', () => {
    assert.strictEqual(
      resolveClineBaseUrl('http://from-body:1', 'http://from-db:2'),
      'http://from-body:1'
    );
  });

  it('resolveClineBaseUrl falls back to OLLAMA_BASE_URL', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    assert.strictEqual(resolveClineBaseUrl(), 'http://localhost:11434');
  });

  it('resolveClineBaseUrl prefers GROQ_OPENAI_BASE_URL over OLLAMA', () => {
    process.env.GROQ_OPENAI_BASE_URL = 'https://api.groq.com/openai';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    assert.strictEqual(resolveClineBaseUrl(), 'https://api.groq.com/openai');
  });

  it('getClineUpstreamKind detects ollama by port', () => {
    assert.strictEqual(getClineUpstreamKind('http://127.0.0.1:11434'), 'ollama');
  });

  it('getResolvedBaseHostHint returns host:port', () => {
    assert.strictEqual(getResolvedBaseHostHint('http://127.0.0.1:11434'), '127.0.0.1:11434');
  });

  it('resolveClineUpstreamModel uses dedicated cline model after env override check', () => {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    assert.strictEqual(
      resolveClineUpstreamModel('http://127.0.0.1:11434', 'gpt-4o', 'mistral:latest'),
      'mistral:latest'
    );
  });

  it('CLINE_DEFAULT_MODEL beats dedicated', () => {
    process.env.CLINE_DEFAULT_MODEL = 'phi3';
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    assert.strictEqual(
      resolveClineUpstreamModel('http://127.0.0.1:11434', 'x', 'y'),
      'phi3'
    );
  });

  it('resolveClineUpstreamModel uses Groq default when upstream is api.groq.com', () => {
    assert.strictEqual(
      resolveClineUpstreamModel('https://api.groq.com/openai', undefined, undefined),
      'llama-3.3-70b-versatile'
    );
  });

  it('resolveClineUpstreamModel ignores Ollama-style main UI model on Groq', () => {
    assert.strictEqual(
      resolveClineUpstreamModel('https://api.groq.com/openai', 'llama3.2', undefined),
      'llama-3.3-70b-versatile'
    );
  });

  it('resolveClineUpstreamModel keeps hyphenated id for Groq when main UI matches Groq', () => {
    assert.strictEqual(
      resolveClineUpstreamModel(
        'https://api.groq.com/openai',
        'llama-3.1-8b-instant',
        undefined
      ),
      'llama-3.1-8b-instant'
    );
  });

  it('resolveClineUpstreamModel uses GROQ_DEFAULT_MODEL on Groq when UI model empty', () => {
    process.env.GROQ_DEFAULT_MODEL = 'llama-3.1-8b-instant';
    assert.strictEqual(
      resolveClineUpstreamModel('https://api.groq.com/openai', '', undefined),
      'llama-3.1-8b-instant'
    );
  });
});
