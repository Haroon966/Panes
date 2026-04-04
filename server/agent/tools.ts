import { DynamicTool } from '@langchain/core/tools';

export type TerminalContext = {
  terminalContext?: string;
  errorContext?: string;
  /** Active terminal tab id; shell tool targets this PTY when connected. */
  terminalSessionId?: string;
};

/** Tools closed over request-scoped terminal / error snapshot. */
export function createTerminalTools(ctx: TerminalContext) {
  return [
    new DynamicTool({
      name: 'get_terminal_snapshot',
      description:
        'Returns the current terminal buffer and any user-attached error for this turn. Call when you need explicit terminal or error details. Takes no input.',
      func: async () => {
        const parts: string[] = [];
        if (ctx.terminalContext) {
          parts.push('Terminal output:\n' + ctx.terminalContext.slice(-12000));
        }
        if (ctx.errorContext) {
          parts.push('Error:\n' + ctx.errorContext);
        }
        return parts.length
          ? parts.join('\n\n')
          : 'No terminal snapshot or error context is available.';
      },
    }),
  ];
}
