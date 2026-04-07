import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  rebuildWorkspaceFtsIndex,
  searchWorkspaceFts,
  workspaceFtsDisabled,
  workspaceFtsRowCount,
} from './workspaceFtsIndexer';

export function createWorkspaceSearchIndexTools(workspaceRootAbs: string) {
  if (workspaceFtsDisabled()) return [];

  const root = path.resolve(workspaceRootAbs);

  return [
    tool(
      async ({ query, limit }) => {
        const n = workspaceFtsRowCount();
        if (n === 0) {
          return (
            'No workspace search index yet. Call **rebuild_workspace_search_index** first, then search again. ' +
            '(Large repos: indexing can take a few seconds.)'
          );
        }
        const hits = searchWorkspaceFts(root, query, limit ?? 15);
        if (!hits.length) {
          return `No FTS matches for query (index has ${n} file(s)). Try different keywords or rebuild if files changed a lot.`;
        }
        const lines = hits.map((h) => `- \`${h.relpath}\` — ${h.snippet.replace(/\s+/g, ' ').trim()}`);
        return `Matches (${hits.length}):\n${lines.join('\n')}`;
      },
      {
        name: 'search_workspace_index',
        description:
          'Full-text search across an FTS index of workspace text files (porter stemmer). Use for broad questions over many files. If empty, rebuild the index first. Complements grep_workspace_content for exact regex searches.',
        schema: z.object({
          query: z.string().min(1).max(500).describe('Keywords to find (words combined with OR)'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(40)
            .optional()
            .describe('Max results (default 15)'),
        }),
      }
    ),
    tool(
      async () => {
        const { filesIndexed, bytesRead } = rebuildWorkspaceFtsIndex(root);
        return `Indexed **${filesIndexed}** file(s), ~${bytesRead} characters of text into workspace_fts.`;
      },
      {
        name: 'rebuild_workspace_search_index',
        description:
          'Rebuild the SQLite FTS5 index from text files under the workspace (skips node_modules, .git, build outputs). Run after clone or large refactors if search_workspace_index is stale or empty.',
        schema: z.object({}),
      }
    ),
  ];
}
