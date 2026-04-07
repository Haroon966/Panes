import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchAllowlistedUrlAsPlainText, MAX_URL_LEN } from './fetchUrlTool.js';

const CHUNK_OVERLAP = 280;

function readDocsToolDisabled(): boolean {
  const a = (process.env.AGENT_DISABLE_READ_DOCS || '').trim().toLowerCase();
  if (a === '1' || a === 'true' || a === 'yes') return true;
  const b = (process.env.AGENT_DISABLE_FETCH_URL || '').trim().toLowerCase();
  return b === '1' || b === 'true' || b === 'yes';
}

function envChunkSize(): number {
  const raw = (process.env.AGENT_READ_DOCS_CHUNK_CHARS || '').trim();
  const n = raw ? Number(raw) : NaN;
  const v = Number.isFinite(n) ? Math.floor(n) : 6000;
  return Math.min(24_000, Math.max(1500, v));
}

/** Exported for tests — splits normalized doc text into overlapping windows. */
export function splitDocText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text) return [];
  if (chunkSize <= 0) return [text];
  let ov = Math.max(0, Math.min(overlap, Math.floor(chunkSize / 2)));
  if (ov >= chunkSize) ov = Math.floor(chunkSize / 4);

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    const next = end - ov;
    start = next > start ? next : end;
  }
  return chunks;
}

export function createReadDocsTool() {
  if (readDocsToolDisabled()) {
    return [];
  }

  return [
    tool(
      async ({ url, chunk_index }: { url: string; chunk_index?: number }) => {
        const result = await fetchAllowlistedUrlAsPlainText(url);
        if (!result.ok) return result.error;

        const body = result.text;
        if (!body) {
          return `read_documentation: ${result.finalUrl} (${result.contentKind}, ${result.byteLength} bytes) — no extractable text.`;
        }

        const chunkSize = envChunkSize();
        const chunks = splitDocText(body, chunkSize, CHUNK_OVERLAP);
        const n = chunks.length;
        const rawIdx = chunk_index ?? 0;
        const idx = Number.isFinite(rawIdx) ? Math.max(0, Math.floor(rawIdx)) : 0;

        if (idx < 0 || idx >= n) {
          return `read_documentation: chunk_index must be between 0 and ${n - 1} (document has ${n} chunk(s), ~${chunkSize} chars each, ${CHUNK_OVERLAP} char overlap). URL: ${result.finalUrl}`;
        }

        const header = [
          `read_documentation`,
          `source: ${result.finalUrl}`,
          `fetched: ${result.contentKind}, ${result.byteLength} bytes`,
          `chunk: ${idx + 1} of ${n} (~${chunkSize} chars per chunk, ${CHUNK_OVERLAP} overlap; use chunk_index 0..${n - 1})`,
        ].join('\n');

        return `${header}\n\n---\n\n${chunks[idx]}`;
      },
      {
        name: 'read_documentation',
        description:
          'Fetch **official documentation** from an **https** URL on the same **allowlist** as **fetch_url** (MDN, language docs, PyPI, npm, GitHub, readthedocs, etc.). Returns **one text chunk** at a time for long pages: start with **chunk_index** 0, then 1, 2, … until you have enough. Prefer this over **fetch_url** when the page may exceed a single model context. Disabled when **AGENT_DISABLE_FETCH_URL** or **AGENT_DISABLE_READ_DOCS** is set.',
        schema: z.object({
          url: z.string().min(8).max(MAX_URL_LEN).describe('Full https URL (allowlisted host).'),
          chunk_index: z
            .number()
            .int()
            .min(0)
            .max(50_000)
            .optional()
            .default(0)
            .describe('Zero-based chunk index; increase to read the next segment of long documents.'),
        }),
      }
    ),
  ];
}
