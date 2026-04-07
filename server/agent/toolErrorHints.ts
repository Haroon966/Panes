export function streamErrorToolHint(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    !m.includes('tool') &&
    !m.includes('bind') &&
    !m.includes('function') &&
    !m.includes('parallel') &&
    !m.includes('json') &&
    !m.includes('schema')
  ) {
    return '';
  }
  return ' Tool calling may be unsupported for this model or provider; try another model that supports tools.';
}
