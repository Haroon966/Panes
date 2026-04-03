import { useTerminalStore } from '@/store/terminalStore';

export function useTerminalSplit() {
  const layout = useTerminalStore((s) => s.layout);
  const splitHorizontal = useTerminalStore((s) => s.splitHorizontal);
  const splitVertical = useTerminalStore((s) => s.splitVertical);
  const closeSplit = useTerminalStore((s) => s.closeSplit);
  return { layout, splitHorizontal, splitVertical, closeSplit };
}
