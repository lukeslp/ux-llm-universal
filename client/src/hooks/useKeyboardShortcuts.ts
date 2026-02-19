// ============================================================
// Keyboard Shortcuts Hook
// Design: Warm Companion — accessible keyboard navigation
// ============================================================

import { useEffect } from 'react';

interface ShortcutHandlers {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onToggleSettings?: () => void;
  onFocusInput?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl/Cmd + N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handlers.onNewChat?.();
        return;
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handlers.onToggleSidebar?.();
        return;
      }

      // Ctrl/Cmd + ,: Toggle settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        handlers.onToggleSettings?.();
        return;
      }

      // / to focus input (only when not in an input)
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        handlers.onFocusInput?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
