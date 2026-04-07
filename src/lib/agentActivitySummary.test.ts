import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeAgentLiveActivity, humanizeAgentToolName } from './agentActivitySummary.js';

describe('agentActivitySummary', () => {
  it('humanizeAgentToolName splits snake_case', () => {
    assert.equal(humanizeAgentToolName('read_workspace_file'), 'Read Workspace File');
  });

  it('describeAgentLiveActivity returns null when not streaming', () => {
    assert.equal(
      describeAgentLiveActivity({
        isStreaming: false,
        activeToolCalls: [{ toolName: 'x', phase: 'running' }],
        pendingHitlCount: 0,
      }),
      null
    );
  });

  it('prefers awaiting_approval in tool rows', () => {
    const s = describeAgentLiveActivity({
      isStreaming: true,
      activeToolCalls: [
        { toolName: 'grep_workspace_content', phase: 'done', title: 'Grep' },
        { toolName: 'write_workspace_file', phase: 'awaiting_approval', title: 'Write file' },
      ],
      pendingHitlCount: 0,
    });
    assert.ok(s?.includes('Write file'));
  });

  it('falls back to running tools', () => {
    const s = describeAgentLiveActivity({
      isStreaming: true,
      activeToolCalls: [{ toolName: 'list_workspace', phase: 'running', title: 'List src' }],
      pendingHitlCount: 0,
    });
    assert.ok(s?.includes('List src'));
  });

  it('uses pendingHitlCount when no awaiting tool row', () => {
    const s = describeAgentLiveActivity({
      isStreaming: true,
      activeToolCalls: [],
      pendingHitlCount: 2,
    });
    assert.ok(s?.includes('2'));
  });

  it('uses graph_phase model when no tools running', () => {
    const s = describeAgentLiveActivity({
      isStreaming: true,
      activeToolCalls: [],
      pendingHitlCount: 0,
      graphPhase: { phase: 'model', langgraphNode: 'agent' },
    });
    assert.ok(s?.includes('generating'));
  });
});
