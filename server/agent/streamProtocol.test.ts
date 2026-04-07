import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTerminalAiEvent } from './streamProtocol.js';
import { parseTerminalAiEventLine } from '../../src/lib/agentStreamProtocol.js';

describe('stream protocol', () => {
  it('formatTerminalAiEvent round-trips through client parseTerminalAiEventLine', () => {
    const ev = {
      kind: 'tool_start' as const,
      callId: 'c1',
      toolName: 'read_file',
      title: 'Read',
      subtitle: 'README.md',
      category: 'file_read' as const,
    };
    const line = formatTerminalAiEvent(ev).trimEnd();
    const parsed = parseTerminalAiEventLine(line);
    assert.deepEqual(parsed, ev);
  });

  it('parseTerminalAiEventLine returns null for non-event lines', () => {
    assert.equal(parseTerminalAiEventLine('hello'), null);
    assert.equal(parseTerminalAiEventLine('TERMINALAI_EVENT:'), null);
    assert.equal(parseTerminalAiEventLine('TERMINALAI_EVENT:{"kind":invalid}'), null);
  });

  it('rejects tool_done with invalid status', () => {
    const line =
      'TERMINALAI_EVENT:' +
      JSON.stringify({ kind: 'tool_done', callId: 'x', status: 'maybe' });
    assert.equal(parseTerminalAiEventLine(line), null);
  });

  it('parses tool_done with optional secretHint', () => {
    const ev = {
      kind: 'tool_done' as const,
      callId: 'c2',
      status: 'ok' as const,
      preview: 'ok',
      secretHint: 'Redacted',
    };
    const line = formatTerminalAiEvent(ev).trimEnd();
    assert.deepEqual(parseTerminalAiEventLine(line), ev);
  });

  it('parses tool_done with optional elapsedMs', () => {
    const ev = {
      kind: 'tool_done' as const,
      callId: 'c3',
      status: 'ok' as const,
      preview: 'done',
      elapsedMs: 42,
    };
    const line = formatTerminalAiEvent(ev).trimEnd();
    assert.deepEqual(parseTerminalAiEventLine(line), ev);
  });

  it('parses usage event and round-trips', () => {
    const ev = { kind: 'usage' as const, inputDelta: 1200, outputDelta: 80 };
    const line = formatTerminalAiEvent(ev).trimEnd();
    assert.deepEqual(parseTerminalAiEventLine(line), ev);
  });

  it('rejects usage with negative deltas', () => {
    const line =
      'TERMINALAI_EVENT:' + JSON.stringify({ kind: 'usage', inputDelta: -1, outputDelta: 0 });
    assert.equal(parseTerminalAiEventLine(line), null);
  });

  it('parses graph_phase and round-trips', () => {
    const ev = {
      kind: 'graph_phase' as const,
      phase: 'tool' as const,
      detail: 'read_workspace_file',
      langgraphNode: 'agent',
    };
    const line = formatTerminalAiEvent(ev).trimEnd();
    assert.deepEqual(parseTerminalAiEventLine(line), ev);
  });

  it('parses approval_required with optional fields', () => {
    const ev = {
      kind: 'approval_required' as const,
      approvalId: 'a1',
      tool: 'write',
      summary: 'Write package.json',
      riskHint: 'high',
      callId: 'c9',
    };
    const line = formatTerminalAiEvent({
      kind: 'approval_required',
      approvalId: 'a1',
      tool: 'write',
      summary: 'Write package.json',
      riskHint: 'high',
      callId: 'c9',
    }).trimEnd();
    assert.deepEqual(parseTerminalAiEventLine(line), ev);
  });
});
