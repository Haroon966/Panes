import { useChatStore } from '@/store/chatStore';

export function useChatStream() {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortStream = useChatStore((s) => s.abortStream);
  const isStreaming = useChatStore((s) => s.isStreaming);
  return { sendMessage, abortStream, isStreaming };
}
