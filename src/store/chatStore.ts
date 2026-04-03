import { create } from 'zustand';

interface ChatState {
  phase: number;
}

export const useChatStore = create<ChatState>(() => ({ phase: 0 }));
