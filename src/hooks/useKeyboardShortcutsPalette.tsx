import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { KeyboardShortcutsDialog } from '@/components/Chat/KeyboardShortcutsDialog';
import { Button } from '@/components/ui/button';

/**
 * - Ctrl/⌘+Shift+K / Ctrl/⌘+Shift+P — toggles command palette (shortcuts & actions) everywhere.
 * - Ctrl/⌘+K — toggles the same except when focus is inside `[data-terminalai-no-palette]`
 *   (workspace Monaco uses ⌘/Ctrl+K for “ask agent about selection”).
 */
export function useKeyboardShortcutsPalette(onOpenApiKeys: () => void) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key?.toLowerCase();
      if (e.shiftKey) {
        if (k === 'k' || k === 'p') {
          e.preventDefault();
          setOpen((v) => !v);
        }
        return;
      }
      if (k !== 'k') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-terminalai-no-palette]')) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const dialog = (
    <KeyboardShortcutsDialog
      open={open}
      onOpenChange={setOpen}
      onOpenApiKeys={onOpenApiKeys}
    />
  );

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 text-2xs text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
      onClick={() => setOpen(true)}
    >
      <Keyboard className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      Shortcuts
    </Button>
  );

  const iconTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-lg text-terminalai-muted hover:bg-terminalai-hover hover:text-terminalai-text"
      onClick={() => setOpen(true)}
      aria-label="Keyboard shortcuts"
    >
      <Keyboard className="h-4 w-4" aria-hidden />
    </Button>
  );

  return { open, setOpen, dialog, trigger, iconTrigger };
}
