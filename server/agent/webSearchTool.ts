import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const DDG_API = 'https://api.duckduckgo.com/';
const MAX_QUERY_LEN = 240;
const FETCH_TIMEOUT_MS = 18_000;
const MAX_RELATED = 12;

function webSearchDisabled(): boolean {
  const v = (process.env.AGENT_DISABLE_WEB_SEARCH || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

type DdgTopic = { Text?: string; FirstURL?: string; Topics?: DdgTopic[] };

/** Exported for tests. */
export function flattenDdgRelatedTopics(
  topics: unknown,
  out: { text: string; url: string }[],
  max: number
): void {
  if (!Array.isArray(topics) || out.length >= max) return;
  for (const t of topics) {
    if (!t || typeof t !== 'object' || out.length >= max) continue;
    const o = t as DdgTopic;
    if (typeof o.Text === 'string' && o.Text.trim()) {
      out.push({
        text: o.Text.trim(),
        url: typeof o.FirstURL === 'string' ? o.FirstURL.trim() : '',
      });
    }
    if (Array.isArray(o.Topics) && out.length < max) {
      flattenDdgRelatedTopics(o.Topics, out, max);
    }
  }
}

/** Exported for tests. */
export function formatDuckDuckGoJson(data: unknown, query: string): string {
  if (!data || typeof data !== 'object') {
    return `No results (invalid response) for ${JSON.stringify(query)}.`;
  }
  const d = data as Record<string, unknown>;
  const parts: string[] = [];

  const heading = typeof d.Heading === 'string' ? d.Heading.trim() : '';
  const abstract = typeof d.AbstractText === 'string' ? d.AbstractText.trim() : '';
  const absUrl = typeof d.AbstractURL === 'string' ? d.AbstractURL.trim() : '';
  if (heading || abstract) {
    parts.push(`## ${heading || query}`);
    if (abstract) parts.push(abstract);
    if (absUrl) parts.push(`Source: ${absUrl}`);
  }

  const answer = typeof d.Answer === 'string' ? d.Answer.trim() : '';
  if (answer) parts.push(`**Instant answer:** ${answer}`);

  const def = typeof d.Definition === 'string' ? d.Definition.trim() : '';
  const defUrl = typeof d.DefinitionURL === 'string' ? d.DefinitionURL.trim() : '';
  if (def) {
    parts.push(`**Definition:** ${def}${defUrl ? ` (${defUrl})` : ''}`);
  }

  const related: { text: string; url: string }[] = [];
  flattenDdgRelatedTopics(d.RelatedTopics, related, MAX_RELATED);
  if (related.length) {
    parts.push('### Related topics');
    for (const r of related) {
      parts.push(r.url ? `- ${r.text} — ${r.url}` : `- ${r.text}`);
    }
  }

  if (parts.length === 0) {
    return `No instant answer from DuckDuckGo for ${JSON.stringify(query)}. Rephrase the query, use **fetch_url** on allowlisted docs, **grep_workspace_content**, or registry tools.`;
  }

  return [`(web_search via DuckDuckGo instant answer)`, '', ...parts].join('\n');
}

async function fetchDuckDuckGoJson(query: string): Promise<unknown> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    no_redirect: '1',
  });
  const url = `${DDG_API}?${params.toString()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TerminalAI/1.0 (agent web_search)',
      },
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} ${r.statusText || ''}`.trim());
    }
    return (await r.json()) as unknown;
  } finally {
    clearTimeout(t);
  }
}

export function createWebSearchTools() {
  if (webSearchDisabled()) {
    return [];
  }

  return [
    tool(
      async ({ query }: { query: string }) => {
        const q = query.trim();
        if (!q) return 'Empty query.';
        try {
          const data = await fetchDuckDuckGoJson(q);
          return formatDuckDuckGoJson(data, q);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return `web_search failed: ${msg}`;
        }
      },
      {
        name: 'web_search',
        description:
          'Search the public web for a short factual summary using DuckDuckGo’s **instant answer** API (no API key). Best for definitions, stable facts, and related topic links — **not** a full search engine results page. If empty, try fetch_url, grep, or npm/PyPI tools.',
        schema: z.object({
          query: z
            .string()
            .min(1)
            .max(MAX_QUERY_LEN)
            .describe('Search query (keywords or question).'),
        }),
      }
    ),
  ];
}
