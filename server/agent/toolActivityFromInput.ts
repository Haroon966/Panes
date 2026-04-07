import type { ToolActivityCategory } from './streamProtocol';

const MAX_SUBTITLE_LEN = 280;

function trunc(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_SUBTITLE_LEN) return t;
  return `${t.slice(0, MAX_SUBTITLE_LEN - 1)}…`;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : undefined;
}

export type ToolActivityMeta = {
  title?: string;
  subtitle?: string;
  category?: ToolActivityCategory;
};

/**
 * Build Cursor-style labels from LangGraph on_tool_start `input` (tool arguments).
 * Returns partial fields; caller merges into tool_start event.
 */
export function toolActivityFromToolStart(toolName: string, input: unknown): ToolActivityMeta {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const o = input as Record<string, unknown>;

  switch (toolName) {
    case 'read_workspace_file': {
      const p = str(o.relative_path)?.trim() || '';
      const sl = num(o.start_line);
      const el = num(o.end_line);
      let subtitle = p;
      if (sl != null) {
        subtitle = el != null ? `${p} (lines ${sl}–${el})` : `${p} (from line ${sl})`;
      }
      return {
        title: 'Read file',
        subtitle: trunc(subtitle),
        category: 'file_read',
      };
    }
    case 'write_workspace_file': {
      const p = str(o.relative_path)?.trim() || '';
      const mode = str(o.mode)?.toLowerCase();
      const creating = mode === 'create';
      return {
        title: creating ? 'Create file' : 'Write file',
        subtitle: trunc(p),
        category: 'file_write',
      };
    }
    case 'search_replace_workspace_file': {
      const p = str(o.relative_path)?.trim() || '';
      return {
        title: 'Edit file',
        subtitle: trunc(p),
        category: 'file_patch',
      };
    }
    case 'list_workspace': {
      const p = str(o.relative_path)?.trim() || '.';
      const display = p === '' ? '.' : p;
      return {
        title: 'List folder',
        subtitle: trunc(display),
        category: 'list',
      };
    }
    case 'find_workspace_files': {
      const suf = str(o.suffix)?.trim();
      const nc = str(o.name_contains)?.trim();
      const parts: string[] = [];
      if (suf) parts.push(`suffix ${suf}`);
      if (nc) parts.push(`name contains "${nc}"`);
      const subtitle = parts.length ? parts.join(' · ') : 'workspace';
      return {
        title: 'Find files',
        subtitle: trunc(subtitle),
        category: 'find',
      };
    }
    case 'grep_workspace_content': {
      const pattern = str(o.pattern)?.trim() || '';
      const glob = str(o.glob)?.trim();
      const fixed = o.fixed_string === true;
      const head = fixed ? `Literal: ${pattern}` : `Pattern: ${pattern}`;
      const subtitle = glob ? `${head} · ${glob}` : head;
      return {
        title: 'Search in files',
        subtitle: trunc(subtitle),
        category: 'grep',
      };
    }
    case 'find_workspace_symbol': {
      const n = str(o.name)?.trim() || '';
      const glob = str(o.glob)?.trim();
      return {
        title: 'Find symbol',
        subtitle: trunc(glob ? `${n} · ${glob}` : n),
        category: 'grep',
      };
    }
    case 'find_workspace_references': {
      const n = str(o.symbol)?.trim() || '';
      const glob = str(o.glob)?.trim();
      return {
        title: 'Find references',
        subtitle: trunc(glob ? `${n} · ${glob}` : n),
        category: 'grep',
      };
    }
    case 'get_workspace_file_outline': {
      const p = str(o.relative_path)?.trim() || '';
      return {
        title: 'File outline',
        subtitle: trunc(p),
        category: 'file_read',
      };
    }
    case 'run_workspace_command': {
      const argv = o.argv;
      let cmd = '';
      if (Array.isArray(argv)) {
        cmd = argv.map((x) => (typeof x === 'string' ? x : String(x))).join(' ');
      }
      return {
        title: 'Run command',
        subtitle: trunc(cmd || '(empty)'),
        category: 'shell',
      };
    }
    case 'run_project_verify_command': {
      return {
        title: 'Project verify',
        subtitle: 'User-configured verify command',
        category: 'shell',
      };
    }
    case 'search_workspace_index': {
      const q = str(o.query)?.trim() || '';
      return {
        title: 'Search index',
        subtitle: trunc(q),
        category: 'grep',
      };
    }
    case 'rebuild_workspace_search_index': {
      return {
        title: 'Rebuild search index',
        subtitle: 'FTS over workspace text files',
        category: 'other',
      };
    }
    case 'get_terminal_snapshot': {
      return {
        title: 'Read terminal',
        subtitle: 'Terminal buffer and attached errors',
        category: 'terminal',
      };
    }
    case 'workspace_path_stat': {
      const p = str(o.relative_path)?.trim() || '.';
      return {
        title: 'Path info',
        subtitle: trunc(p),
        category: 'other',
      };
    }
    case 'delete_workspace_file': {
      const p = str(o.relative_path)?.trim() || '';
      return {
        title: 'Delete path',
        subtitle: trunc(p),
        category: 'file_write',
      };
    }
    case 'copy_workspace_file': {
      const s = str(o.source_path)?.trim() || '';
      const d = str(o.dest_path)?.trim() || '';
      return {
        title: 'Copy file',
        subtitle: trunc(`${s} → ${d}`),
        category: 'file_write',
      };
    }
    case 'move_workspace_file': {
      const s = str(o.source_path)?.trim() || '';
      const d = str(o.dest_path)?.trim() || '';
      return {
        title: 'Move file',
        subtitle: trunc(`${s} → ${d}`),
        category: 'file_write',
      };
    }
    case 'search_npm_packages': {
      const q = str(o.query)?.trim() || '';
      return {
        title: 'Search npm',
        subtitle: trunc(q),
        category: 'other',
      };
    }
    case 'lookup_pypi_project': {
      const n = str(o.project_name)?.trim() || '';
      return {
        title: 'PyPI lookup',
        subtitle: trunc(n),
        category: 'other',
      };
    }
    case 'fetch_url': {
      const u = str(o.url)?.trim() || '';
      return {
        title: 'Fetch URL',
        subtitle: trunc(u),
        category: 'other',
      };
    }
    case 'read_documentation': {
      const u = str(o.url)?.trim() || '';
      const ci = num(o.chunk_index);
      const subtitle = ci != null && ci > 0 ? `${u} · chunk ${ci}` : u;
      return {
        title: 'Read documentation',
        subtitle: trunc(subtitle),
        category: 'other',
      };
    }
    case 'web_search': {
      const q = str(o.query)?.trim() || '';
      return {
        title: 'Web search',
        subtitle: trunc(q),
        category: 'other',
      };
    }
    default:
      return {};
  }
}
