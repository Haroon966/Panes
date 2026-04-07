import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Keeps a slide-over mounted through its close animation.
 * When `narrow` becomes false (e.g. viewport crosses desktop breakpoint), unmounts in a layout
 * effect so the desktop column and mobile sheet never share the same paint (avoids duplicate ids).
 */
export function useSlideOverPresence(
  isOpen: boolean,
  narrow: boolean,
  durationMs = 220
): { render: boolean; visible: boolean } {
  const [render, setRender] = useState(() => isOpen && narrow);
  const [visible, setVisible] = useState(() => isOpen && narrow);

  useLayoutEffect(() => {
    if (!narrow) {
      setVisible(false);
      setRender(false);
    }
  }, [narrow]);

  useEffect(() => {
    if (!narrow) return;
    if (isOpen) {
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRender(false), durationMs);
    return () => window.clearTimeout(t);
  }, [isOpen, narrow, durationMs]);

  return { render, visible };
}
