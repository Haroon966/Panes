import { create } from 'zustand';

interface TerminalState {
  phase: number;
}

export const useTerminalStore = create<TerminalState>(() => ({ phase: 0 }));
