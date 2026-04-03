import { TerminalInstance } from './TerminalInstance';

/** Main terminal wrapper — tabs/splits in later phases */
export function TerminalPanel() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center border-b border-terminalai-border bg-terminalai-terminal px-3 py-2 text-xs text-terminalai-muted">
        <span className="font-medium text-terminalai-text">Terminal</span>
      </header>
      <div className="min-h-0 flex-1 p-2">
        <TerminalInstance />
      </div>
    </div>
  );
}
