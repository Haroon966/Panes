/** Phase 6 — parse stderr for clickable errors */

export interface ErrorMatch {
  line: number;
  text: string;
}

export function parseErrors(terminalOutput: string): ErrorMatch[] {
  void terminalOutput;
  return [];
}
