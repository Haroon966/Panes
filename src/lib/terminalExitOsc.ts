/* eslint-disable no-control-regex -- PTY / ANSI parsing */
/**
 * TerminalAI private OSC (stripped client-side before xterm paint):
 * - ESC ] 773 ; exit ; <code> BEL — fish/bash integration (command exit code)
 * - ESC ] 773 ; tab ; <base64 utf-8> BEL — rename tab (`terminalai-tab-name` / `terminalai_tab_name`)
 * - ESC ] 773 ; pwd ; <base64 utf-8 path> BEL — physical cwd after each command (persisted workspace)
 */
export interface ExitOscCarry {
  pending: string;
}

export function createExitOscCarry(): ExitOscCarry {
  return { pending: '' };
}

function decodeBase64Utf8(b64: string): string | null {
  const t = b64.trim();
  if (t === '') return '';
  try {
    const padLen = (4 - (t.length % 4)) % 4;
    const pad = padLen ? '='.repeat(padLen) : '';
    const bin = atob(t.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

const PRIVATE_OSC_RE = /\x1b\]773;(exit|tab|pwd);([^;\x07]*);\x07/g;

/**
 * Remove TerminalAI private OSC sequences from a PTY chunk. Handles sequences split across WebSocket frames.
 */
export function stripTerminalAiExitOsc(
  chunk: string,
  carry: ExitOscCarry
): { text: string; exitCodes: number[]; tabTitles: string[]; cwdPaths: string[] } {
  const s = carry.pending + chunk;
  carry.pending = '';
  const exitCodes: number[] = [];
  const tabTitles: string[] = [];
  const cwdPaths: string[] = [];
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  PRIVATE_OSC_RE.lastIndex = 0;
  while ((m = PRIVATE_OSC_RE.exec(s)) !== null) {
    out += s.slice(last, m.index);
    if (m[1] === 'exit') {
      exitCodes.push(parseInt(m[2], 10));
    } else {
      const decoded = decodeBase64Utf8(m[2]);
      if (decoded !== null) {
        if (m[1] === 'tab') tabTitles.push(decoded);
        else cwdPaths.push(decoded);
      }
    }
    last = m.index + m[0].length;
  }
  let tail = s.slice(last);
  const incomplete = tail.match(/\x1b\][^\x07]*$/);
  if (incomplete?.[0].includes('773')) {
    carry.pending = incomplete[0];
    tail = tail.slice(0, -incomplete[0].length);
  }
  out += tail;
  return { text: out, exitCodes, tabTitles, cwdPaths };
}
