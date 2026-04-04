import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';

/** Polite announcements for stream stop and similar (screen readers). */
export function ChatA11yAnnouncer() {
  const msg = useChatStore((s) => s.a11yAnnouncement);
  const setA11y = useChatStore((s) => s.setA11yAnnouncement);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setA11y(''), 2800);
    return () => window.clearTimeout(t);
  }, [msg, setA11y]);
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {msg}
    </div>
  );
}
