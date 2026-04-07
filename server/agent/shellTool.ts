import { spawn } from 'node:child_process';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPtySession } from '../ptySessionRegistry';
import { agentReadOnlyMode, requireApprovalForShell, shellToolEnabled } from './approvalEnv';
import { runIntegratedPtyCommand } from './ptyIntegratedCommand';
import { registerPendingShell } from './pendingApprovalsStore';

function shellTimeoutMs(): number {
  const n = Number(process.env.AGENT_SHELL_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 600_000) : 120_000;
}

function maxOutputChars(): number {
  const n = Number(process.env.AGENT_SHELL_MAX_OUTPUT_CHARS);
  return Number.isFinite(n) && n >= 500 ? Math.min(n, 500_000) : 24_000;
}

/** Comma-separated substrings; if non-empty, joined command string must include one. */
function allowlistOk(argv: string[]): boolean {
  const raw = process.env.AGENT_SHELL_ALLOWLIST?.trim();
  if (!raw) return true;
  const cmd = argv.join(' ');
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.some((p) => cmd.includes(p));
}

export function runSpawnInWorkspace(workspaceRootAbs: string, argv: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: workspaceRootAbs,
      env: { ...process.env },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const cap = maxOutputChars();
    const onData = (chunk: Buffer, which: 'o' | 'e') => {
      const s = chunk.toString('utf8');
      if (which === 'o') {
        out += s;
        if (out.length > cap) out = out.slice(0, cap) + '\n… [stdout truncated]';
      } else {
        err += s;
        if (err.length > cap) err = err.slice(0, cap) + '\n… [stderr truncated]';
      }
    };
    child.stdout?.on('data', (c) => onData(c, 'o'));
    child.stderr?.on('data', (c) => onData(c, 'e'));
    const t = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`timeout after ${shellTimeoutMs()}ms`));
    }, shellTimeoutMs());
    child.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(t);
      const parts = [`exit ${code ?? 'unknown'}`];
      if (out.trim()) parts.push('--- stdout ---\n' + out.trimEnd());
      if (err.trim()) parts.push('--- stderr ---\n' + err.trimEnd());
      resolve(parts.join('\n'));
    });
  });
}

export async function executeShellCommand(
  workspaceRootAbs: string,
  argv: string[],
  terminalSessionId?: string
): Promise<string> {
  const root = path.resolve(workspaceRootAbs);
  const forceSubprocess = process.env.AGENT_SHELL_SUBPROCESS_ONLY === '1';
  const sid = terminalSessionId?.trim();

  if (!forceSubprocess && sid && getPtySession(sid)) {
    try {
      return await runIntegratedPtyCommand(sid, root, argv, shellTimeoutMs(), maxOutputChars());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        const sub = await runSpawnInWorkspace(root, argv);
        return `Integrated terminal failed (${msg}). Subprocess fallback:\n\n${sub}`;
      } catch (e2) {
        return `Shell error: ${msg}; fallback failed: ${e2 instanceof Error ? e2.message : String(e2)}`;
      }
    }
  }

  try {
    const sub = await runSpawnInWorkspace(root, argv);
    if (!forceSubprocess && sid && !getPtySession(sid)) {
      return `No live integrated terminal for this tab (open the terminal panel and keep it connected). Ran via server subprocess:\n\n${sub}`;
    }
    return sub;
  } catch (e) {
    return `Shell error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export function createShellTools(
  workspaceRootAbs: string,
  opts?: { terminalSessionId?: string; userAlwaysConfirmMutations?: boolean }
) {
  if (!shellToolEnabled()) return [];
  if (agentReadOnlyMode()) return [];

  const root = path.resolve(workspaceRootAbs);
  const terminalSessionId = opts?.terminalSessionId;
  const shellNeedApproval =
    !!opts?.userAlwaysConfirmMutations || requireApprovalForShell();

  return [
    tool(
      async ({ argv }) => {
        if (argv.length < 1 || !argv[0]?.trim()) {
          return 'Refused: argv must include an executable as argv[0].';
        }
        if (!allowlistOk(argv)) {
          return `Refused: command not allowed by AGENT_SHELL_ALLOWLIST (got: ${argv.join(' ')}).`;
        }

        const preview = argv.join(' ');

        if (shellNeedApproval) {
          const id = registerPendingShell({
            workspaceRootAbs: root,
            argv,
            terminalSessionId,
          });
          return `PENDING_APPROVAL:${JSON.stringify({ id, command: preview })}`;
        }

        return executeShellCommand(root, argv, terminalSessionId);
      },
      {
        name: 'run_workspace_command',
        description:
          'Run a command in the workspace directory. When the UI terminal tab is connected, runs in that integrated shell (visible in the terminal); otherwise runs as a server subprocess. argv[0] is the executable (e.g. "npm"), following entries are arguments (no shell). Requires AGENT_ALLOW_SHELL=1. Often needs user approval in the UI.',
        schema: z.object({
          argv: z
            .array(z.string())
            .min(1)
            .describe('Executable and arguments, e.g. ["npm","run","build"]'),
        }),
      }
    ),
  ];
}
