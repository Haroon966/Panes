/** Regex fragments for common error signatures (PRD § 4.1) */
const ERROR_PATTERN_SRC = [
  'Error:',
  'error:',
  'ERROR:',
  'FAILED',
  'npm ERR!',
  'SyntaxError',
  'Traceback',
  'fatal:',
  'ENOENT',
  'EACCES',
  'Exception',
  'panic:',
  'Segmentation fault',
  '\\[31m', // red ANSI often used for errors
].join('|');

const LINE_ERROR_RE = new RegExp(`(${ERROR_PATTERN_SRC})`);

export interface ErrorMatch {
  line: number;
  text: string;
  start: number;
  end: number;
}

export interface LineErrorRange {
  start: number;
  end: number;
}

export function findErrorRangesInLine(line: string): LineErrorRange[] {
  const ranges: LineErrorRange[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(LINE_ERROR_RE.source, 'gi');
  while ((m = re.exec(line)) !== null) {
    const idx = m.index;
    const end = Math.min(line.length - 1, idx + Math.max(m[0].length, 3));
    ranges.push({ start: idx, end });
  }
  return ranges;
}

export function parseErrors(terminalOutput: string): ErrorMatch[] {
  const lines = terminalOutput.split('\n');
  const out: ErrorMatch[] = [];
  lines.forEach((text, i) => {
    if (new RegExp(LINE_ERROR_RE.source, 'i').test(text)) {
      const r = findErrorRangesInLine(text)[0];
      if (r) out.push({ line: i, text, start: r.start, end: r.end });
    }
  });
  return out;
}

export function extractErrorContext(bufferLines: string[], lineIndex: number, radius = 5): string {
  const start = Math.max(0, lineIndex - radius);
  const end = Math.min(bufferLines.length, lineIndex + radius + 1);
  return bufferLines.slice(start, end).join('\n');
}
