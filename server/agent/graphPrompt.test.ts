import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  agentCorePromptIncludesToolRouting,
  buildTerminalAgentTools,
  type AgentRuntimeContext,
} from './graph.js';

function minimalCtx(): AgentRuntimeContext {
  return {
    workspaceRootAbs: '/tmp/ws',
    agentVerbosity: 'detailed',
    agentContextHints: '',
    agentAutoMode: true,
    pinnedFilesPromptAppend: '',
    agentVerifyCommand: '',
    workspaceSkillsPromptAppend: '',
    workspaceReadPathsThisTurn: new Set(),
    clientWorkspaceDirtyPathSet: new Set(),
  };
}

describe('TerminalAI graph prompt', () => {
  it('keeps a Tool routing section in the core system prompt', () => {
    assert.equal(agentCorePromptIncludesToolRouting(), true);
  });

  it('warns about vague UI vocabulary vs code symbols', () => {
    const graphTs = path.join(path.dirname(fileURLToPath(import.meta.url)), 'graph.ts');
    const src = fs.readFileSync(graphTs, 'utf8');
    assert.ok(
      src.includes('Vague UI words') && src.includes('navbar'),
      'graph.ts should guide agents past literal navbar filename search'
    );
  });

  it('registers a substantial tool set for a typical workspace context', () => {
    const tools = buildTerminalAgentTools(minimalCtx());
    assert.ok(tools.length >= 8);
    const names = new Set(tools.map((t) => t.name));
    assert.equal(names.has('read_workspace_file'), true);
    assert.equal(names.has('grep_workspace_content'), true);
  });
});
