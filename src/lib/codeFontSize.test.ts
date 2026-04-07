import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampCodeFontSizePx,
  CODE_FONT_SIZE_DEFAULT,
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
} from './codeFontSize.js';

test('clampCodeFontSizePx clamps to range', () => {
  assert.equal(clampCodeFontSizePx(5), CODE_FONT_SIZE_MIN);
  assert.equal(clampCodeFontSizePx(99), CODE_FONT_SIZE_MAX);
  assert.equal(clampCodeFontSizePx(13.7), 14);
  assert.equal(clampCodeFontSizePx(Number.NaN), CODE_FONT_SIZE_DEFAULT);
});
