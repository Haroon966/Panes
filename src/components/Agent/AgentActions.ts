const DESTRUCTIVE =
  /rm\s+(-[rf]*rf|-fr)\s|rm\s+-rf|\bdd\s+if=|mkfs\.|DROP\s+TABLE|curl[^|\n]*\|\s*(ba)?sh|sudo\s+rm|format\s+c:|del\s+\/s/i;

export function isDestructiveCommand(cmd: string): boolean {
  return DESTRUCTIVE.test(cmd);
}

export const agentActions = { isDestructiveCommand };
