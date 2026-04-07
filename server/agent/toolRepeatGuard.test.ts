import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  toolStartFingerprint,
  updateRepeatStreak,
} from './toolRepeatGuard.js';

describe('toolRepeatGuard', () => {
  it('stable fingerprints for same logical input', () => {
    const a = toolStartFingerprint('list_workspace', { relative_path: '.', max_entries: 10 });
    const b = toolStartFingerprint('list_workspace', { max_entries: 10, relative_path: '.' });
    assert.equal(a, b);
  });

  it('updateRepeatStreak aborts when streak hits limit', () => {
    const st = { lastFingerprint: '', count: 0 };
    const fp = toolStartFingerprint('x', { y: 1 });
    assert.equal(updateRepeatStreak(st, fp, 3), false);
    assert.equal(st.count, 1);
    assert.equal(updateRepeatStreak(st, fp, 3), false);
    assert.equal(st.count, 2);
    assert.equal(updateRepeatStreak(st, fp, 3), true);
    assert.equal(st.count, 3);
  });

  it('resets streak on different fingerprint', () => {
    const st = { lastFingerprint: '', count: 0 };
    updateRepeatStreak(st, 'a', 2);
    updateRepeatStreak(st, 'a', 2);
    assert.equal(st.count, 2);
    updateRepeatStreak(st, 'b', 2);
    assert.equal(st.count, 1);
  });
});
