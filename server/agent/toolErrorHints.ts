export function streamErrorToolHint(err: unknown, opts: { cline?: boolean }): string {
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
  if (opts.cline) {
    return ' Tool calling may be unsupported for this upstream model. Set CLINE_AGENT_DISABLE_TOOLS=1 in server .env to use plain chat for Cline, or pick a model that supports OpenAI-style tools.';
  }
  return ' Tool calling may be unsupported for this model or provider; try another model that supports tools.';
}
