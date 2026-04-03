/** Extract ```bash / ```sh fenced blocks */
export function extractShellCommands(text: string): string[] {
  const out: string[] = [];
  const re = /```(?:bash|sh|shell|zsh|fish)?\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1].trim();
    if (body) out.push(body.split('\n')[0]?.trim() || body);
  }
  return out;
}
