import { useTerminalStore } from '@/store/terminalStore';

/** Terminal output capture is driven from `TerminalInstance` via `appendOutputLine`. */
export function useErrorCapture() {
  const lines = useTerminalStore((s) => s.outputLines);
  return { outputLines: lines };
}
