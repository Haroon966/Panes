import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prefsPutSchema } from './persistence.js';

describe('prefsPutSchema', () => {
  it('accepts minimal required fields with agent backend and cline model', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentBackend: 'cline',
      clineModel: 'llama3.2:latest',
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.agentBackend, 'cline');
      assert.equal(r.data.clineModel, 'llama3.2:latest');
    }
  });

  it('rejects invalid agentBackend', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'x',
      agentBackend: 'other',
    });
    assert.equal(r.success, false);
  });

  it('allows omitting agentBackend and clineModel (server merges from existing row)', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'ollama',
      selectedModel: 'mistral',
    });
    assert.equal(r.success, true);
  });

  it('accepts optional colorScheme', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      colorScheme: 'system',
    });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.colorScheme, 'system');
  });

  it('accepts optional codeFontSizePx in range', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      codeFontSizePx: 18,
    });
    assert.equal(r.success, true);
  });

  it('rejects codeFontSizePx out of range', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      codeFontSizePx: 30,
    });
    assert.equal(r.success, false);
  });

  it('accepts optional agentVerbosity and agentContextHints', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentVerbosity: 'step_by_step',
      agentContextHints: 'Use Vitest; prefer small PR-sized changes.',
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.agentVerbosity, 'step_by_step');
      assert.equal(r.data.agentContextHints, 'Use Vitest; prefer small PR-sized changes.');
    }
  });

  it('rejects agentContextHints over 4000 chars', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentContextHints: 'x'.repeat(4001),
    });
    assert.equal(r.success, false);
  });

  it('accepts optional agentAutoMode', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentAutoMode: false,
    });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.agentAutoMode, false);
  });

  it('accepts optional agentPinnedPaths (up to 8)', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentPinnedPaths: ['src/a.ts', 'README.md'],
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.deepEqual(r.data.agentPinnedPaths, ['src/a.ts', 'README.md']);
    }
  });

  it('rejects agentPinnedPaths with more than 8 entries', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentPinnedPaths: Array.from({ length: 9 }, (_, i) => `f${i}.ts`),
    });
    assert.equal(r.success, false);
  });

  it('rejects agentPinnedPaths entry over max length', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      agentPinnedPaths: ['x'.repeat(513)],
    });
    assert.equal(r.success, false);
  });

  it('accepts optional workspaceFormatOnSave', () => {
    const r = prefsPutSchema.safeParse({
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      workspaceFormatOnSave: true,
    });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.workspaceFormatOnSave, true);
  });
});
