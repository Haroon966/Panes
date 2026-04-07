import { spawn } from 'node:child_process';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Env-like basenames that often contain secrets. We still allow `.env.example`, `.env.sample`, etc.
 * Used by `grep_workspace_content` (ripgrep + grep fallback).
 */
export const WORKSPACE_GREP_SECRET_ENV_BASENAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.staging',
  '.env.test',
  '.env.development.local',
  '.env.production.local',
  '.env.test.local',
] as const;

const GREP_EXCLUDE_DIRS = ['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'] as const;

/** Ripgrep `--glob` exclusions (default: noisy dirs + secret env files). */
export function workspaceGrepRipgrepExcludeGlobs(): string[] {
  const dirs: string[] = [
    '!**/.git/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/.next/**',
    '!**/coverage/**',
  ];
  const env = WORKSPACE_GREP_SECRET_ENV_BASENAMES.map((b) => `!**/${b}`);
  return [...dirs, ...env];
}

function grepTimeoutMs(): number {
  const n = Number(process.env.AGENT_GREP_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 120_000) : 45_000;
}

function maxGrepOutputChars(): number {
  const n = Number(process.env.AGENT_GREP_MAX_OUTPUT_CHARS);
  return Number.isFinite(n) && n >= 2000 ? Math.min(n, 200_000) : 32_000;
}

function runRipgrep(
  cwd: string,
  pattern: string,
  opts: { fixedString: boolean; glob?: string }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const args = [
      '-n',
      '--no-heading',
      '--color',
      'never',
      '--max-columns',
      '500',
    ];
    if (opts.fixedString) args.push('-F');
    for (const g of workspaceGrepRipgrepExcludeGlobs()) {
      args.push('--glob', g);
    }
    if (opts.glob?.trim()) {
      args.push('--glob', opts.glob.trim());
    }
    args.push('-e', pattern, '.');
    const child = spawn('rg', args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const cap = maxGrepOutputChars();
    const onOut = (chunk: Buffer, which: 'o' | 'e') => {
      const s = chunk.toString('utf8');
      if (which === 'o') {
        stdout += s;
        if (stdout.length > cap) stdout = stdout.slice(0, cap) + '\n… [grep stdout truncated]';
      } else {
        stderr += s;
        if (stderr.length > 2000) stderr = stderr.slice(0, 2000) + '…';
      }
    };
    child.stdout?.on('data', (c) => onOut(c, 'o'));
    child.stderr?.on('data', (c) => onOut(c, 'e'));
    const t = setTimeout(() => {
      child.kill('SIGTERM');
    }, grepTimeoutMs());
    child.on('error', (err) => {
      clearTimeout(t);
      resolve({ stdout: '', stderr: err.message, code: -1 });
    });
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code });
    });
  });
}

function runGrepFallback(
  cwd: string,
  pattern: string,
  opts: { fixedString: boolean; glob?: string }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const args = ['-RIn'];
    if (opts.fixedString) args.push('-F');
    for (const d of GREP_EXCLUDE_DIRS) {
      args.push(`--exclude-dir=${d}`);
    }
    for (const b of WORKSPACE_GREP_SECRET_ENV_BASENAMES) {
      args.push(`--exclude=${b}`);
    }
    const g = opts.glob?.trim();
    if (g) args.push(`--include=${g}`);
    args.push('-e', pattern, '.');
    const child = spawn('grep', args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const cap = maxGrepOutputChars();
    const onOut = (chunk: Buffer, which: 'o' | 'e') => {
      const s = chunk.toString('utf8');
      if (which === 'o') {
        stdout += s;
        if (stdout.length > cap) stdout = stdout.slice(0, cap) + '\n… [grep stdout truncated]';
      } else {
        stderr += s;
        if (stderr.length > 2000) stderr = stderr.slice(0, 2000) + '…';
      }
    };
    child.stdout?.on('data', (c) => onOut(c, 'o'));
    child.stderr?.on('data', (c) => onOut(c, 'e'));
    const t = setTimeout(() => {
      child.kill('SIGTERM');
    }, grepTimeoutMs());
    child.on('error', (err) => {
      clearTimeout(t);
      resolve({ stdout: '', stderr: err.message, code: -1 });
    });
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code });
    });
  });
}

/** Run ripgrep/grep over the workspace; shared by `grep_workspace_content` and symbol helpers. */
export async function runWorkspaceContentGrep(
  workspaceRootAbs: string,
  pattern: string,
  opts: {
    fixed_string?: boolean;
    glob?: string;
    max_line_hits?: number;
    /** Prepended to the success message (e.g. "Symbol search") */
    resultLabel?: string;
  }
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const p = pattern.trim();
  if (!p) return 'Refused: pattern must be non-empty.';
  const cap = Math.min(500, Math.max(8, opts.max_line_hits ?? 120));
  let { stdout, stderr, code } = await runRipgrep(root, p, {
    fixedString: opts.fixed_string ?? false,
    glob: opts.glob?.trim() || undefined,
  });
  let engine = 'rg';
  const missingRg = code === -1 && /ENOENT|spawn rg/i.test(stderr);
  if (missingRg) {
    const fb = await runGrepFallback(root, p, {
      fixedString: opts.fixed_string ?? false,
      glob: opts.glob?.trim() || undefined,
    });
    stdout = fb.stdout;
    stderr = fb.stderr;
    code = fb.code;
    engine = 'grep';
  }
  if (code !== 0 && code !== 1 && code != null) {
    return `grep failed (${engine}, exit ${code}): ${stderr || 'unknown error'}`;
  }
  if (code == null && !stdout && stderr) {
    return `grep interrupted (${engine}): ${stderr.trim() || 'unknown'}`;
  }
  const lines = stdout.split(/\n/).filter(Boolean);
  const head = lines.slice(0, cap);
  const more = lines.length > cap ? `\n… and ${lines.length - cap} more matches (raise max_line_hits or narrow pattern/glob)` : '';
  if (head.length === 0) {
    return `No matches for pattern (${engine}).${stderr ? ` (${stderr.trim()})` : ''}`;
  }
  const label = opts.resultLabel?.trim() || 'Content search';
  return `${label} (${engine}, paths relative to workspace):\n${head.join('\n')}${more}`;
}

/** Search file contents under the workspace (ripgrep if available, else grep -R). */
export function createGrepWorkspaceTool(workspaceRootAbs: string) {
  const root = path.resolve(workspaceRootAbs);

  return [
    tool(
      async ({ pattern, fixed_string, glob, max_line_hits }) => {
        return runWorkspaceContentGrep(root, pattern, {
          fixed_string,
          glob,
          max_line_hits,
          resultLabel: 'Content search',
        });
      },
      {
        name: 'grep_workspace_content',
        description:
          'Search for a pattern in file contents under the workspace (like ripgrep). Use after find_workspace_files when you need symbols or strings inside files. Prefer fixed_string true for literals. Optional glob filters paths (e.g. "*.ts"). By default skips .git, node_modules, dist, build, .next, coverage, and common secret env files (.env, .env.local, …) while still allowing .env.example. Respects AGENT_GREP_TIMEOUT_MS and AGENT_GREP_MAX_OUTPUT_CHARS.',
        schema: z.object({
          pattern: z.string().describe('Search pattern (regex unless fixed_string is true)'),
          fixed_string: z
            .boolean()
            .optional()
            .describe('If true, treat pattern as a literal string (-F)'),
          glob: z
            .string()
            .optional()
            .describe('Optional ripgrep/grep style glob, e.g. "*.ts" or "*.{ts,tsx}"'),
          max_line_hits: z
            .number()
            .optional()
            .describe('Max matching lines to return (default 120, max 500)'),
        }),
      }
    ),
  ];
}
