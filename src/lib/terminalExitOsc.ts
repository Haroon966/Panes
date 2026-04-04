/* eslint-disable no-control-regex -- PTY / ANSI parsing */
/**
 * TerminalAI private OSC: ESC ] 773 ; exit ; <code> BEL
 * Emitted by fish (server shellIntegration) or optional bash PROMPT_COMMAND; stripped before xterm paint.
 */
export interface ExitOscCarry {
  pending: string;
}

export function createExitOscCarry(): ExitOscCarry {
  return { pending: '' };
}

/**
 * Remove exit-code OSC sequences from a PTY chunk. Handles sequences split across WebSocket frames.
 */
export function stripTerminalAiExitOsc(
  chunk: string,
  carry: ExitOscCarry
): { text: string; exitCodes: number[] } {
  const s = carry.pending + chunk;
  carry.pending = '';
  const exitCodes: number[] = [];
  const re = /\x1b\]773;exit;(\d+);\x07/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out += s.slice(last, m.index);
    exitCodes.push(parseInt(m[1], 10));
    last = m.index + m[0].length;
  }
  let tail = s.slice(last);
  const incomplete = tail.match(/\x1b\][^\x07]*$/);
  if (incomplete?.[0].includes('773')) {
    carry.pending = incomplete[0];
    tail = tail.slice(0, -incomplete[0].length);
  }
  out += tail;
  return { text: out, exitCodes };
}
