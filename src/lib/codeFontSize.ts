export const CODE_FONT_SIZE_MIN = 10;
export const CODE_FONT_SIZE_MAX = 22;
export const CODE_FONT_SIZE_DEFAULT = 13;

export function clampCodeFontSizePx(n: number): number {
  if (!Number.isFinite(n)) return CODE_FONT_SIZE_DEFAULT;
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, Math.round(n)));
}
