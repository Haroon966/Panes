import { TerminalPanel } from '@/components/Terminal/TerminalPanel';

export function TerminalOnlyPage() {
  return (
    <div className="h-screen min-h-0 bg-terminalai-bg p-2 text-terminalai-text">
      <TerminalPanel />
    </div>
  );
}
