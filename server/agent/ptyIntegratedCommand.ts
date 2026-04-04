import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { IPty } from 'node-pty';
import { getPtySession } from '../ptySessionRegistry';

function shellSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function argvToShellWords(argv: string[]): string {
  return argv.map(shellSingleQuote).join(' ');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFishShell(shellLabel: string): boolean {
  return shellLabel.trim().toLowerCase() === 'fish';
}

function buildOneLiner(
  workspaceRootAbs: string,
  argv: string[],
  shellLabel: string,
  start: string,
  end: string
): string {
  const ws = path.resolve(workspaceRootAbs);
  const qWs = shellSingleQuote(ws);
  const words = argvToShellWords(argv);
  const qStart = shellSingleQuote(start);
  const trailer = isFishShell(shellLabel)
    ? `printf '\\n${end} %s\\n' $status`
    : `printf '\\n${end} %s\\n' $?`;
  return `echo ${qStart}; cd ${qWs} && ${words}; ${trailer}`;
}

function parseCapture(acc: string, start: string, end: string): { body: string; exitToken: string | undefined } {
  const si = acc.indexOf(start);
  if (si < 0) {
    throw new Error('Command did not produce start marker (shell busy, blocked, or output lost)');
  }
  const afterS = acc.slice(si + start.length);
  const ei = afterS.indexOf(end);
  if (ei < 0) {
    throw new Error('Command did not produce end marker (timeout or incomplete output)');
  }
  let body = afterS.slice(0, ei);
  body = body.replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '');
  const tail = afterS.slice(ei);
  const re = new RegExp(`^${escapeRe(end)}\\s+(\\S+)`, 'm');
  const m = tail.match(re);
  return { body: body.trimEnd(), exitToken: m?.[1] };
}

const sessionLocks = new Map<string, Promise<void>>();

async function withSessionQueue<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  sessionLocks.set(sessionId, prev.then(() => next));
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (sessionLocks.get(sessionId) === next) {
      sessionLocks.delete(sessionId);
    }
  }
}

export async function runIntegratedPtyCommand(
  sessionId: string,
  workspaceRootAbs: string,
  argv: string[],
  timeoutMs: number,
  maxChars: number
): Promise<string> {
  return withSessionQueue(sessionId, async () => {
    const entry = getPtySession(sessionId);
    if (!entry) {
      throw new Error('Terminal session not connected');
    }
    return runOnPty(entry.pty, entry.shellLabel, workspaceRootAbs, argv, timeoutMs, maxChars);
  });
}

function runOnPty(
  pty: IPty,
  shellLabel: string,
  workspaceRootAbs: string,
  argv: string[],
  timeoutMs: number,
  maxChars: number
): Promise<string> {
  const id = randomBytes(8).toString('hex');
  const start = `__TA_CMD_S_${id}__`;
  const end = `__TA_CMD_E_${id}__`;
  const line = buildOneLiner(workspaceRootAbs, argv, shellLabel, start, end);

  return new Promise((resolve, reject) => {
    let acc = '';
    let settled = false;
    const sub = pty.onData((chunk) => {
      if (settled) return;
      acc += chunk;
      if (acc.length > maxChars) {
        settled = true;
        sub.dispose();
        clearTimeout(t);
        reject(new Error(`integrated terminal output exceeded ${maxChars} chars`));
        return;
      }
      if (!acc.includes(start) || !acc.includes(end)) return;
      try {
        const { body, exitToken } = parseCapture(acc, start, end);
        settled = true;
        sub.dispose();
        clearTimeout(t);
        const parts = [`exit ${exitToken ?? 'unknown'}`];
        if (body.trim()) parts.push('--- integrated terminal ---\n' + body.trimEnd());
        resolve(parts.join('\n'));
      } catch {
        /* wait for more data until timeout */
      }
    });

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.dispose();
      reject(new Error(`integrated terminal timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      pty.write(`${line}\r`);
    } catch (e) {
      if (!settled) {
        settled = true;
        sub.dispose();
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }
  });
}
