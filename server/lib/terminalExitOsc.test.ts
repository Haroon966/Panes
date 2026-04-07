import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createExitOscCarry, stripTerminalAiExitOsc } from '../../src/lib/terminalExitOsc.js';

describe('stripTerminalAiExitOsc', () => {
  it('extracts pwd OSC and strips it from visible text', () => {
    const carry = createExitOscCarry();
    const cwd = '/tmp/foo bar';
    const b64 = Buffer.from(cwd, 'utf8').toString('base64');
    const osc = `\x1b]773;pwd;${b64};\x07`;
    const { text, cwdPaths, exitCodes, tabTitles } = stripTerminalAiExitOsc(`a${osc}b`, carry);
    assert.equal(text, 'ab');
    assert.deepEqual(exitCodes, []);
    assert.deepEqual(tabTitles, []);
    assert.equal(cwdPaths.length, 1);
    assert.equal(cwdPaths[0], cwd);
  });

  it('handles exit and pwd in one chunk', () => {
    const carry = createExitOscCarry();
    const cwd = '/proj';
    const b64 = Buffer.from(cwd, 'utf8').toString('base64');
    const chunk = `\x1b]773;exit;0;\x07\x1b]773;pwd;${b64};\x07`;
    const { exitCodes, cwdPaths } = stripTerminalAiExitOsc(chunk, carry);
    assert.deepEqual(exitCodes, [0]);
    assert.equal(cwdPaths[0], cwd);
  });
});
