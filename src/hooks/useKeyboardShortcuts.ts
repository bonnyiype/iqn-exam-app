import { useEffect } from 'react';

type KeyboardShortcuts = {
  [key: string]: () => void;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      let shortcutKey = '';
      if (ctrl) shortcutKey += 'Ctrl+';
      if (shift) shortcutKey += 'Shift+';
      if (alt) shortcutKey += 'Alt+';
      shortcutKey += key;

      // Check for exact key match first
      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key]();
        return;
      }

      // Check for modified key combinations
      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

// Predefined keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  NEXT_QUESTION: 'ArrowRight',
  PREV_QUESTION: 'ArrowLeft',
  SUBMIT: 'Ctrl+Enter',
  FLAG_QUESTION: 'f',
  TOGGLE_TIMER: 't',
  PAUSE_RESUME: ' ', // Space
  OPTION_A: 'a',
  OPTION_B: 'b',
  OPTION_C: 'c',
  OPTION_D: 'd',
  OPTION_E: 'e',
};
