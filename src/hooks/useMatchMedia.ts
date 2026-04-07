import { useSyncExternalStore } from 'react';

/**
 * Subscribes to `window.matchMedia(query)`. Server snapshot is `false` (client-only app).
 */
export function useMatchMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
