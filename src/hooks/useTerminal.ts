/** Phase 5+ — xterm helpers; wire pasteAndRun when terminal store is connected */
export function useTerminal() {
  return {
    pasteAndRun: (cmd: string) => {
      void cmd;
    },
  };
}
