import net from 'node:net';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const DEFAULT_ALLOWED_HOSTS = [
  'developer.mozilla.org',
  'nodejs.org',
  'docs.python.org',
  'www.python.org',
  'typescriptlang.org',
  'www.typescriptlang.org',
  'learn.microsoft.com',
  'pypi.org',
  'www.pypi.org',
  'registry.npmjs.org',
  'www.npmjs.com',
  'npmjs.com',
  'raw.githubusercontent.com',
  'github.com',
  'www.github.com',
  'en.cppreference.com',
  'wiki.sei.cmu.edu',
  'www.rfc-editor.org',
  'datatracker.ietf.org',
] as const;

const DEFAULT_HOST_SET = new Set<string>(DEFAULT_ALLOWED_HOSTS);

export const MAX_URL_LEN = 2048;
const MAX_REDIRECTS = 5;
const MAX_RETURN_CHARS = 24_000;

export type FetchAllowlistedPlainTextOk = {
  ok: true;
  finalUrl: string;
  text: string;
  contentKind: 'html' | 'text' | 'json' | 'xml';
  byteLength: number;
};

export type FetchAllowlistedPlainTextResult = FetchAllowlistedPlainTextOk | { ok: false; error: string };

/**
 * HTTPS GET with the same allowlist, redirect, size, and timeout rules as **fetch_url**.
 * Returns normalized plain text (full body, not truncated to MAX_RETURN_CHARS).
 */
export async function fetchAllowlistedUrlAsPlainText(
  initialUrl: string
): Promise<FetchAllowlistedPlainTextResult> {
  const maxBytes = envInt('AGENT_FETCH_URL_MAX_BYTES', 400_000, 8_000, 2_000_000);
  const timeoutMs = envInt('AGENT_FETCH_URL_TIMEOUT_MS', 20_000, 3_000, 120_000);

  let current = initialUrl.trim();
  let finalUrl = current;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const v = validateUrlForFetch(current);
    if (!v.ok) return { ok: false, error: v.error };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let r: Response;
    try {
      r = await fetch(v.url.href, {
        redirect: 'manual',
        signal: ac.signal,
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml,text/xml,text/plain,application/json;q=0.9,*/*;q=0.05',
          'User-Agent': 'TerminalAI/1.0 (agent fetch_url; documentation fetch)',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `fetch_url failed: ${msg}` };
    } finally {
      clearTimeout(timer);
    }

    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (!loc) return { ok: false, error: `HTTP ${r.status} redirect without Location header` };
      if (hop === MAX_REDIRECTS) return { ok: false, error: 'Too many redirects' };
      try {
        current = new URL(loc, v.url.href).href;
        finalUrl = current;
      } catch {
        return { ok: false, error: 'Invalid redirect Location URL' };
      }
      continue;
    }

    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status} ${r.statusText || ''}`.trim() };
    }

    const ctHeader = r.headers.get('content-type') || '';
    const parsedCt = contentTypeOk(ctHeader);
    if (!parsedCt.ok) {
      return {
        ok: false,
        error: `Unsupported or missing Content-Type (${ctHeader || 'none'}). Allowed: HTML, plain text, JSON, XML.`,
      };
    }

    const buf = await r.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      return { ok: false, error: `Response body too large (${buf.byteLength} bytes; max ${maxBytes}).` };
    }

    let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (parsedCt.kind === 'html' || parsedCt.kind === 'xml') {
      text = htmlToPlainText(text);
    } else if (parsedCt.kind === 'json') {
      try {
        const j = JSON.parse(text) as unknown;
        text = JSON.stringify(j, null, 2);
      } catch {
        /* keep raw */
      }
    }

    if (parsedCt.kind === 'json') {
      text = text.trim();
    } else {
      text = text.replace(/\s+/g, ' ').trim();
    }

    return {
      ok: true,
      finalUrl,
      text,
      contentKind: parsedCt.kind,
      byteLength: buf.byteLength,
    };
  }

  return { ok: false, error: 'Too many redirects' };
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] || '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function fetchUrlToolDisabled(): boolean {
  const v = (process.env.AGENT_DISABLE_FETCH_URL || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Exported for tests. */
export function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local')) return true;
  if (net.isIPv4(h)) {
    const parts = h.split('.').map(Number);
    const a = parts[0] ?? -1;
    const b = parts[1] ?? -1;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(h)) {
    if (h === '::1') return true;
    return h.startsWith('fc') || h.startsWith('fd');
  }
  return false;
}

function readExtraAllowlistHosts(): string[] {
  return (process.env.AGENT_FETCH_URL_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Exported for tests. */
export function hostAllowedForFetch(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'readthedocs.io' || h.endsWith('.readthedocs.io')) return true;
  if (h.endsWith('.github.io')) return true;
  if (DEFAULT_HOST_SET.has(h)) return true;
  return readExtraAllowlistHosts().includes(h);
}

/** Exported for tests. */
export function validateUrlForFetch(urlStr: string): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = urlStr.trim();
  if (!trimmed || trimmed.length > MAX_URL_LEN) {
    return { ok: false, error: 'URL empty or too long' };
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (u.protocol !== 'https:') {
    return { ok: false, error: 'Only https:// URLs are allowed' };
  }
  if (u.username || u.password) {
    return { ok: false, error: 'URLs with credentials are not allowed' };
  }
  const host = u.hostname;
  if (isPrivateOrLocalHost(host)) {
    return { ok: false, error: 'Local or private hosts are not allowed' };
  }
  if (!hostAllowedForFetch(host)) {
    return {
      ok: false,
      error: `Host "${host}" is not allowlisted for fetch_url. Set AGENT_FETCH_URL_ALLOWLIST (comma-separated hostnames) on the server.`,
    };
  }
  return { ok: true, url: u };
}

/** Exported for tests. */
export function htmlToPlainText(html: string): string {
  let s = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function contentTypeOk(ctRaw: string): { ok: true; kind: 'html' | 'text' | 'json' | 'xml' } | { ok: false } {
  const ct = ctRaw.split(';')[0]?.trim().toLowerCase() || '';
  if (ct === 'text/html' || ct === 'application/xhtml+xml') return { ok: true, kind: 'html' };
  if (ct === 'text/plain') return { ok: true, kind: 'text' };
  if (ct === 'application/json' || ct.endsWith('+json')) return { ok: true, kind: 'json' };
  if (ct === 'text/xml' || ct === 'application/xml' || ct.endsWith('+xml')) return { ok: true, kind: 'xml' };
  return { ok: false };
}

export function createFetchUrlTool() {
  if (fetchUrlToolDisabled()) {
    return [];
  }

  return [
    tool(
      async ({ url }: { url: string }) => {
        const result = await fetchAllowlistedUrlAsPlainText(url);
        if (!result.ok) return result.error;

        let text = result.text;
        if (text.length > MAX_RETURN_CHARS) {
          text = `${text.slice(0, MAX_RETURN_CHARS)}\n\n…[truncated to ${MAX_RETURN_CHARS} characters]`;
        }

        const kind = result.contentKind;
        return `Fetched ${result.finalUrl} (${kind}, ${result.byteLength} bytes)\n\n${text}`;
      },
      {
        name: 'fetch_url',
        description:
          'Download a public **https** document from an **allowlisted** host (MDN, Node, Python, TS, PyPI, npm, GitHub raw/user pages, cppreference, RFC editor, etc.). Returns plain text (HTML is stripped). Follows redirects only if each hop stays allowlisted. Not a general open web fetch — ask the operator to add hosts via AGENT_FETCH_URL_ALLOWLIST if needed.',
        schema: z.object({
          url: z.string().min(8).max(MAX_URL_LEN).describe('Full https URL to fetch.'),
        }),
      }
    ),
  ];
}
