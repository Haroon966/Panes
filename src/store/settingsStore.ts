import { create } from 'zustand';

interface SettingsState {
  phase: number;
}

export const useSettingsStore = create<SettingsState>(() => ({ phase: 0 }));
