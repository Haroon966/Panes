/* eslint-disable no-control-regex -- ANSI stripping for status heuristics */
import { findErrorRangesInLine } from '@/utils/errorParser';

export type TerminalStatusKind =
  | 'ready'
  | 'running'
  | 'success'
  | 'error'
  | 'interactive'
  | 'disconnected';

export interface TerminalStatusSnapshot {
  kind: TerminalStatusKind;
  label: string;
  /** Wall-clock ms when this session entered Running (for elapsed display). */
  runningStartedAtMs?: number;
}

const DEFAULT_LABELS: Record<TerminalStatusKind, string> = {
  ready: 'READY',
  running: 'RUNNING',
  success: 'SUCCESS',
  error: 'ERROR',
  interactive: 'RUNNING',
  disconnected: 'Disconnected',
};

export interface ClassifyLineOptions {
  /** After at least one exit OSC was applied, do not infer success/error from output while Running. */
  exitOscPrimary?: boolean;
}

/** Strip ANSI SGR and OSC sequences for pattern matching. */
export function stripAnsiForStatus(s: string): string {
  return s
    .replace(/\x1b\[[\d;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\].*?(\x1b\\|\x9c)/g, '');
}

const INTERACTIVE_RE =
  /password\s*:|passphrase|touch\s*id|sudo.*password|authentication\s+required|\[sudo\]\s+password|enter\s+.*password|verification\s+code|otp|one[- ]time|2fa|mfa|type\s+yes|type\s+'yes'|\[y\/n\]|\(y\/n\)|\[Y\/n\]|\(Y\/n\)|\byes\/no\b|\[yes\/no\]|are\s+you\s+sure|do\s+you\s+want\s+to|is\s+this\s+ok|continue\s*\?|proceed\s*\?|ok\s*\?|abort\s*\?|overwrite\s*\?|replace\s*\?|delete\s*\?|remove\s*\?|install\s*\?|uninstall\s*\?|press\s+enter|press\s+any\s+key|press\s+RETURN|hit\s+enter|choose\s+an?\s+option|select\s+(a\s+)?(number|option)|enter\s+choice|pick\s+one/i;

const MENU_LINE_RE = /^\s*\d+[).]\s+.{2,}/;

/**
 * Shell prompt heuristics (fish, bash, zsh, Starship, pure).
 * Avoid loose `>`-only matches on long lines (build tools, HTML).
 */
function looksLikeStrictShellPrompt(line: string): boolean {
  const s = stripAnsiForStatus(line).trimEnd();
  if (s.length === 0 || s.length > 200) return false;

  if (/\w+@[\w.-]+/.test(s) && /[>#%$]\s*$/.test(s)) return true;
  if (/\([^)]+\)\s*[#$%>]\s*$/.test(s)) return true;

  if (s.length <= 140 && /[>#%$]\s*$/.test(s) && (/[~@]/.test(s) || /:\/[^\s]+/.test(s))) {
    return true;
  }

  if (s.length <= 140 && /[❯➜]\s*$/u.test(s) && (/[~@/]/.test(s) || /\w+@\w/.test(s) || s.length <= 48)) {
    return true;
  }
  if (s.length <= 140 && /\u03bb\s*$/u.test(s) && (/[~@/]/.test(s) || s.length <= 32)) {
    return true;
  }

  if (s.length <= 24 && /^\s*([$#%❯➜]|\u03bb|>)\s*$/u.test(s)) {
    return true;
  }

  return false;
}

function looksInteractive(line: string): boolean {
  const s = stripAnsiForStatus(line);
  if (!s.trim()) return false;
  if (INTERACTIVE_RE.test(s)) return true;
  if (MENU_LINE_RE.test(s) && /select|choose|option|pick|which/i.test(s)) return true;
  return false;
}

function looksError(line: string): boolean {
  const plain = stripAnsiForStatus(line);
  if (!plain.trim()) return false;
  if (findErrorRangesInLine(plain).length > 0) return true;
  return (
    /command not found|not recognized as an internal or external command|exited with code [1-9]\d*|exit code [1-9]\d*|returned non-zero|fatal error|compilation terminated|error TS\d+:/i.test(
      plain
    ) || /\bFAIL\b|\bFailed\b.*\berror\b/i.test(plain)
  );
}

function errorLabel(line: string): string {
  const plain = stripAnsiForStatus(line).trim();
  if (plain.length <= 48) return plain || DEFAULT_LABELS.error;
  return `${plain.slice(0, 45)}…`;
}

function interactiveLabel(line: string): string {
  const plain = stripAnsiForStatus(line).trim();
  if (/password|passphrase/i.test(plain)) return 'RUNNING — credential prompt';
  if (/\[y\/n\]|\(y\/n\)|yes\/no|are you sure|do you want/i.test(plain)) return 'RUNNING — confirm';
  if (/select|choose|option|pick|which \d/i.test(plain)) return 'RUNNING — choose option';
  if (/press (any key|enter)/i.test(plain)) return 'RUNNING — press a key';
  return DEFAULT_LABELS.running;
}

/**
 * After PTY chunks, the "current line" is often only present after the last `\n` and last `\r`
 * (CR redraw without LF). Used so prompt detection runs even when the shell never sent `\n`.
 */
export function getLastLogicalLineForStatus(outBuf: string): string {
  if (!outBuf) return '';
  const normalized = outBuf.replace(/\r\n/g, '\n');
  const lastNl = normalized.lastIndexOf('\n');
  const afterLastNl = lastNl === -1 ? normalized : normalized.slice(lastNl + 1);
  const lastCr = afterLastNl.lastIndexOf('\r');
  return lastCr === -1 ? afterLastNl : afterLastNl.slice(lastCr + 1);
}

/**
 * Classify one logical line of PTY output given previous UI status.
 */
export function classifyLine(
  rawLine: string,
  prev: TerminalStatusSnapshot,
  opts?: ClassifyLineOptions
): TerminalStatusSnapshot | undefined {
  const line = rawLine.replace(/\r$/, '');
  const visible = stripAnsiForStatus(line).trim();
  if (!visible) return undefined;

  const exitOsc = opts?.exitOscPrimary ?? false;

  if (looksInteractive(line)) {
    return { kind: 'running', label: interactiveLabel(line), runningStartedAtMs: prev.runningStartedAtMs };
  }

  if (looksError(line)) {
    if (exitOsc && prev.kind === 'running') return undefined;
    return { kind: 'error', label: errorLabel(line) };
  }

  if (looksLikeStrictShellPrompt(line)) {
    if (prev.kind === 'running') {
      if (exitOsc) return undefined;
      return snapshotSuccess();
    }
    if (prev.kind === 'success') {
      return undefined;
    }
    if (prev.kind === 'error') {
      return undefined;
    }
    return snapshotReady();
  }

  return undefined;
}

export function computeStatusFromLogicalTail(
  outBuf: string,
  prev: TerminalStatusSnapshot,
  opts?: ClassifyLineOptions
): TerminalStatusSnapshot | undefined {
  return classifyLine(getLastLogicalLineForStatus(outBuf), prev, opts);
}

/** @deprecated Prefer computeStatusFromLogicalTail — kept for API stability; uses last logical line only. */
export function computeStatusFromOutputTail(
  tail: string,
  prev: TerminalStatusSnapshot,
  opts?: ClassifyLineOptions
): TerminalStatusSnapshot | undefined {
  const logical = getLastLogicalLineForStatus(tail);
  const visible = stripAnsiForStatus(logical).trim();
  if (!visible) return undefined;
  if (looksInteractive(logical)) {
    return { kind: 'running', label: interactiveLabel(logical), runningStartedAtMs: prev.runningStartedAtMs };
  }
  const exitOsc = opts?.exitOscPrimary ?? false;
  if (looksError(logical) && !looksLikeStrictShellPrompt(logical)) {
    if (exitOsc && prev.kind === 'running') return undefined;
    return { kind: 'error', label: errorLabel(logical) };
  }
  return undefined;
}

export function computeStatusFromOutputLine(
  rawLine: string,
  prev: TerminalStatusSnapshot,
  opts?: ClassifyLineOptions
): TerminalStatusSnapshot | undefined {
  return classifyLine(rawLine, prev, opts);
}

export function snapshotForUserCommand(): TerminalStatusSnapshot {
  return { kind: 'running', label: DEFAULT_LABELS.running, runningStartedAtMs: Date.now() };
}

export function snapshotDisconnected(): TerminalStatusSnapshot {
  return { kind: 'disconnected', label: DEFAULT_LABELS.disconnected };
}

export function snapshotReady(): TerminalStatusSnapshot {
  return { kind: 'ready', label: DEFAULT_LABELS.ready };
}

export function snapshotSuccess(): TerminalStatusSnapshot {
  return { kind: 'success', label: DEFAULT_LABELS.success };
}

export function snapshotErrorFromExitCode(code: number): TerminalStatusSnapshot {
  const interrupted = code === 130 || code === 2;
  return {
    kind: 'error',
    label: interrupted ? 'ERROR (interrupted)' : `ERROR (exit ${code})`,
  };
}

export { DEFAULT_LABELS };
