import { execSync } from 'node:child_process';
import * as pty from 'node-pty';

function commandPath(cmd: string): string | null {
  try {
    const out = execSync(`command -v ${cmd}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function resolveShellPath(): { path: string; label: string } {
  const preferred = (process.env.SHELL_DEFAULT || 'fish').trim();
  const ordered = [preferred, 'fish', 'bash', 'sh'];
  const seen = new Set<string>();
  for (const cmd of ordered) {
    if (!cmd || seen.has(cmd)) continue;
    seen.add(cmd);
    const p = commandPath(cmd);
    if (p) return { path: p, label: cmd };
  }
  throw new Error('No shell found (tried SHELL_DEFAULT, fish, bash, sh)');
}

export interface ShellSessionMeta {
  shellLabel: string;
  shellPath: string;
}

export function getShellSessionMeta(resolved: { path: string; label: string }): ShellSessionMeta {
  return {
    shellLabel: resolved.label,
    shellPath: resolved.path,
  };
}

export function logFishAvailability(): void {
  const fish = commandPath('fish');
  if (fish) {
    try {
      const ver = execSync(`"${fish}" --version`, { encoding: 'utf8' }).trim();
      console.log(`[TerminalAI] ${ver} (${fish})`);
    } catch {
      console.log('[TerminalAI] Fish found at', fish);
    }
  } else {
    console.warn(
      '[TerminalAI] Fish is not installed or not on PATH. Install fish for the best experience, or set SHELL_DEFAULT=bash.'
    );
  }
}

export interface PtySessionOptions {
  cols: number;
  rows: number;
  cwd?: string;
}

export interface PtySession {
  pty: pty.IPty;
  meta: ShellSessionMeta;
}

export function createPtySession(options: PtySessionOptions): PtySession {
  const resolved = resolveShellPath();
  const meta = getShellSessionMeta(resolved);
  const shellPath = resolved.path;
  const label = resolved.label;
  const cwd = options.cwd ?? process.env.HOME ?? process.cwd();
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  } as Record<string, string>;

  console.log(`[TerminalAI] Spawning PTY: ${label} -> ${shellPath}`);

  const proc = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols: Math.max(2, options.cols),
    rows: Math.max(2, options.rows),
    cwd,
    env,
  });

  return { pty: proc, meta };
}
