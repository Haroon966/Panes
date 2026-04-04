/**
 * Quick sanity check for agent workspace resolution (no LLM call).
 * Run: npm run test:agent
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAgentWorkspaceRoot } from '../agent/workspaceRoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const root = resolveAgentWorkspaceRoot();
  const pkgPath = path.join(root, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as { name?: string };
  console.log('[agent-smoke] workspace root:', root);
  console.log('[agent-smoke] package.json name:', pkg.name ?? '(missing)');
  const repoRoot = path.resolve(__dirname, '../..');
  if (path.resolve(root) !== repoRoot) {
    console.warn('[agent-smoke] root is not repo root; set cwd or AGENT_WORKSPACE_ROOT for full check');
  }
}

main().catch((e) => {
  console.error('[agent-smoke] failed:', e);
  process.exit(1);
});
