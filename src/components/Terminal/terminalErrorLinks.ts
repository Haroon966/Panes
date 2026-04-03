import type { IDisposable, ILink, Terminal } from '@xterm/xterm';
import { useChatStore } from '@/store/chatStore';
import { findErrorRangesInLine } from '@/utils/errorParser';

/** Registers xterm link targets for error-like lines (PRD § 4.1). */
export function registerTerminalErrorLinks(term: Terminal): IDisposable {
  return term.registerLinkProvider({
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void) {
      const line = term.buffer.active.getLine(bufferLineNumber);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const ranges = findErrorRangesInLine(text);
      if (!ranges.length) {
        callback(undefined);
        return;
      }
      const y = bufferLineNumber + 1;
      const links: ILink[] = ranges.map((r) => ({
        text: text.slice(r.start, Math.min(text.length, r.end + 1)),
        range: {
          start: { x: r.start + 1, y },
          end: { x: Math.min(term.cols, r.end + 2), y },
        },
        activate: (_e, t) => {
          useChatStore.getState().setErrorContext(t.trim());
          useChatStore.getState().requestFocusChat();
        },
        decorations: { underline: true, pointerCursor: true },
      }));
      callback(links);
    },
  });
}
