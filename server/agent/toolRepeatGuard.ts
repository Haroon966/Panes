/**
 * Abort agent stream when the same tool is invoked with the same arguments repeatedly.
 * Controlled by AGENT_TOOL_REPEAT_GUARD (minimum consecutive identical starts before abort).
 */

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export function toolStartFingerprint(toolName: string, input: unknown): string {
  return `${toolName}\n${stableStringify(input)}`;
}

export function parseToolRepeatGuardLimit(): number {
  const raw = process.env.AGENT_TOOL_REPEAT_GUARD?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 2) return 0;
  return Math.min(20, Math.floor(n));
}

/**
 * @returns `true` if the run should stop (streak reached limit).
 */
export function updateRepeatStreak(
  state: { lastFingerprint: string; count: number },
  fingerprint: string,
  limit: number
): boolean {
  if (fingerprint === state.lastFingerprint) {
    state.count++;
  } else {
    state.lastFingerprint = fingerprint;
    state.count = 1;
  }
  return limit > 0 && state.count >= limit;
}
