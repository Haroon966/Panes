/**
 * Parse Cursor / VS Code–style `.mcp.json` (root object with `mcpServers`).
 * Runtime MCP connections are not implemented — this is for discovery and UI only.
 */

export type McpServerEntry = {
  name: string;
  command?: string;
  args?: string[];
};

export type ParseMcpConfigResult =
  | { ok: true; servers: McpServerEntry[] }
  | { ok: false; error: string };

export function parseMcpConfigJson(text: string): ParseMcpConfigResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Root must be a JSON object' };
  }
  const root = parsed as Record<string, unknown>;
  const mcpServers = root.mcpServers;
  if (!mcpServers || typeof mcpServers !== 'object' || Array.isArray(mcpServers)) {
    return { ok: false, error: 'Missing or invalid `mcpServers` object' };
  }
  const servers: McpServerEntry[] = [];
  for (const [name, v] of Object.entries(mcpServers)) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const entry: McpServerEntry = { name: trimmed };
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const cfg = v as Record<string, unknown>;
      if (typeof cfg.command === 'string') entry.command = cfg.command;
      if (Array.isArray(cfg.args) && cfg.args.every((a) => typeof a === 'string')) {
        entry.args = cfg.args as string[];
      }
    }
    servers.push(entry);
  }
  return { ok: true, servers };
}
