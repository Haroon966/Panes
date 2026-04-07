/** HTTP statuses where a fresh POST may succeed (rate limits, upstream blips). */
const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);

const DEFAULT_MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 450;
const MAX_DELAY_MS = 12_000;

export function isAgentStreamRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

function backoffMs(attemptIndex: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * 280);
  return exp + jitter;
}

async function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  await new Promise<void>((resolve, reject) => {
    const id = globalThis.setTimeout(resolve, ms);
    const onAbort = () => {
      globalThis.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * POST for agent SSE streams; retries on network errors and retryable HTTP statuses
 * before the response body is consumed. Honors `init.signal` (no retry after abort).
 */
export async function fetchAgentStreamWithRetry(
  url: string,
  init: RequestInit,
  options?: { maxAttempts?: number }
): Promise<Response> {
  const maxAttempts = Math.min(8, Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const signal = init.signal;
  if (!signal) {
    return fetch(url, init);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const res = await fetch(url, init);

      if (res.ok) {
        return res;
      }

      const retryable = isAgentStreamRetryableStatus(res.status);
      const willRetry = retryable && attempt < maxAttempts - 1;

      if (!willRetry) {
        return res;
      }

      await res.text().catch(() => {});
      await sleepAbortable(backoffMs(attempt), signal);
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw e;
      }
      if (attempt >= maxAttempts - 1) {
        throw e;
      }
      await sleepAbortable(backoffMs(attempt), signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
