import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/** Fish hook path: env override, then cwd, then bundled server dir (tsx / dist-server). */
export function resolveTerminalAiFishHookPath(): string | null {
  const fromEnv = process.env.TERMINALAI_FISH_HOOK?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const cwdHook = join(process.cwd(), 'server/shellIntegration/terminalai-fish-hook.fish');
  if (existsSync(cwdHook)) return cwdHook;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const bundled = join(here, 'shellIntegration/terminalai-fish-hook.fish');
    if (existsSync(bundled)) return bundled;
  } catch {
    //
  }

  return null;
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

  let spawnArgs: string[] = [];
  if (label === 'fish') {
    const hook = resolveTerminalAiFishHookPath();
    if (hook) {
      spawnArgs = ['-C', `source ${JSON.stringify(hook)}`];
    } else {
      console.warn(
        '[TerminalAI] terminalai-fish-hook.fish not found; set TERMINALAI_FISH_HOOK or keep server/shellIntegration in cwd.'
      );
    }
  }

  console.log(`[TerminalAI] Spawning PTY: ${label} -> ${shellPath}`);

  const proc = pty.spawn(shellPath, spawnArgs, {
    name: 'xterm-256color',
    cols: Math.max(2, options.cols),
    rows: Math.max(2, options.rows),
    cwd,
    env,
  });

  return { pty: proc, meta };
}
