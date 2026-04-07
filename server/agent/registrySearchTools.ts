import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
const PYPI_JSON_URL = (name: string) =>
  `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;

const MAX_QUERY_LEN = 120;
const MAX_NPM_RESULTS = 15;
const FETCH_TIMEOUT_MS = 20_000;

function registryToolsDisabled(): boolean {
  const v = (process.env.AGENT_DISABLE_PACKAGE_REGISTRY_TOOLS || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

async function fetchJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TerminalAI/1.0 (+https://github.com/terminalai) registry lookup',
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

type NpmPackage = { name?: string; version?: string; description?: string };

function pickNpmPackages(data: unknown): NpmPackage[] {
  if (!data || typeof data !== 'object') return [];
  const objects = (data as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) return [];
  const out: NpmPackage[] = [];
  for (const o of objects) {
    if (!o || typeof o !== 'object') continue;
    const pkg = (o as { package?: unknown }).package;
    if (!pkg || typeof pkg !== 'object') continue;
    const p = pkg as Record<string, unknown>;
    const name = typeof p.name === 'string' ? p.name : '';
    if (!name) continue;
    out.push({
      name,
      version: typeof p.version === 'string' ? p.version : undefined,
      description: typeof p.description === 'string' ? p.description : undefined,
    });
    if (out.length >= MAX_NPM_RESULTS) break;
  }
  return out;
}

/** Exported for tests. */
export function formatNpmSearchResults(data: unknown, query: string): string {
  const rows = pickNpmPackages(data);
  if (rows.length === 0) {
    return `No npm packages found for query: ${JSON.stringify(query)}`;
  }
  const lines = rows.map((p) => {
    const ver = p.version ? ` @ ${p.version}` : '';
    const desc = p.description ? ` — ${p.description.slice(0, 200)}${p.description.length > 200 ? '…' : ''}` : '';
    return `- **${p.name}**${ver}${desc}`;
  });
  return `npm registry search (${rows.length} results):\n${lines.join('\n')}`;
}

/** Exported for tests. */
export function formatPypiProjectJson(data: unknown, requestedName: string): string {
  if (!data || typeof data !== 'object') return `Unexpected PyPI response for ${JSON.stringify(requestedName)}`;
  const info = (data as { info?: unknown }).info;
  if (!info || typeof info !== 'object') return `Unexpected PyPI response for ${JSON.stringify(requestedName)}`;
  const i = info as Record<string, unknown>;
  const name = typeof i.name === 'string' ? i.name : requestedName;
  const version = typeof i.version === 'string' ? i.version : '(unknown)';
  const summary = typeof i.summary === 'string' ? i.summary : '';
  const license = typeof i.license === 'string' ? i.license : '';
  const requires = typeof i.requires_python === 'string' ? i.requires_python : '';
  const urls = i.project_urls;
  let home = '';
  if (urls && typeof urls === 'object' && !Array.isArray(urls)) {
    const u = urls as Record<string, string>;
    home = u.Homepage || u.homepage || u.Source || u.Repository || '';
  }
  const parts = [
    `**${name}** ${version}`,
    summary && `Summary: ${summary}`,
    license && `License: ${license}`,
    requires && `Requires Python: ${requires}`,
    home && `Homepage: ${home}`,
  ].filter(Boolean);
  return parts.join('\n');
}

const querySchema = z.string().min(1).max(MAX_QUERY_LEN).describe('Search text (package name or keyword).');
const pypiNameSchema = z
  .string()
  .min(1)
  .max(MAX_QUERY_LEN)
  .describe('Exact PyPI distribution name (e.g. requests, pydantic).');

export function createRegistrySearchTools() {
  if (registryToolsDisabled()) {
    return [];
  }

  return [
    tool(
      async ({ query }: { query: string }) => {
        const q = query.trim();
        if (!q) return 'Empty query.';
        const url = `${NPM_SEARCH_URL}?text=${encodeURIComponent(q)}&size=${MAX_NPM_RESULTS}`;
        try {
          const data = await fetchJson(url);
          return formatNpmSearchResults(data, q);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return `npm search failed: ${msg}`;
        }
      },
      {
        name: 'search_npm_packages',
        description:
          'Search the public npm registry by name or keyword. Returns matching package names, latest versions, and short descriptions. Use when the user asks about npm packages or needs a dependency name.',
        schema: z.object({ query: querySchema }),
      }
    ),
    tool(
      async ({ project_name }: { project_name: string }) => {
        const name = project_name.trim();
        if (!name) return 'Empty project name.';
        const url = PYPI_JSON_URL(name);
        try {
          const data = await fetchJson(url);
          return formatPypiProjectJson(data, name);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('404') || msg.includes('HTTP 404')) {
            return `No PyPI project found with exact name ${JSON.stringify(name)}. Try a different spelling or use web search.`;
          }
          return `PyPI lookup failed: ${msg}`;
        }
      },
      {
        name: 'lookup_pypi_project',
        description:
          'Look up a Python package on PyPI by **exact** project name (e.g. requests). Returns latest version, summary, license, and homepage when available. Not a fuzzy search — if 404, try alternate spellings or ask the user.',
        schema: z.object({ project_name: pypiNameSchema }),
      }
    ),
  ];
}
