import { useCallback, useEffect, useState } from 'react';
import {
  clearAgentStreamInterruptedNotice,
  readAgentStreamInterruptedNotice,
  recordAgentStreamInterrupted,
} from '@/lib/agentStreamInterruptedNotice';
import { useChatStore } from '@/store/chatStore';

/**
 * If the user closed or reloaded the tab while the agent was streaming, sessionStorage holds a flag.
 * Shows a one-time banner for the matching conversation (not automatic stream resumption).
 */
export function useAgentStreamInterruptedNotice(activeConversationId: string | null) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const n = readAgentStreamInterruptedNotice();
    if (!n || !activeConversationId) {
      setShow(false);
      return;
    }
    setShow(n.conversationId === activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    const onPageHide = () => {
      const { isStreaming, activeConversationId: id } = useChatStore.getState();
      if (isStreaming && id) recordAgentStreamInterrupted(id);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const dismiss = useCallback(() => {
    clearAgentStreamInterruptedNotice();
    setShow(false);
  }, []);

  return { showAgentStreamInterruptedBanner: show, dismissAgentStreamInterruptedBanner: dismiss };
}
