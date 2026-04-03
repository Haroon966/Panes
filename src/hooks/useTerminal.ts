import { useTerminalStore } from '@/store/terminalStore';

export function useTerminal() {
  const pasteAndRun = useTerminalStore((s) => s.pasteAndRun);
  const write = (data: string) => {
    const id = useTerminalStore.getState().focusedSessionId || useTerminalStore.getState().activeSessionId;
    useTerminalStore.getState().controllers[id]?.write(data);
  };
  const clear = () => {
    const id = useTerminalStore.getState().focusedSessionId || useTerminalStore.getState().activeSessionId;
    useTerminalStore.getState().controllers[id]?.clear();
  };
  const resize = () => {
    const id = useTerminalStore.getState().focusedSessionId || useTerminalStore.getState().activeSessionId;
    useTerminalStore.getState().controllers[id]?.resize();
  };
  return { write, clear, resize, pasteAndRun };
}
