"use client";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "./ThemeProvider";
import KeyboardShortcuts from "./KeyboardShortcuts";

/**
 * Global keyboard shortcut listener.
 * Mounted once in the root layout — provides the `?` panel
 * and delegates navigation shortcuts to the hook.
 */
export default function KeyboardShortcutProvider() {
  const { toggleTheme } = useTheme();
  const { showPanel, setShowPanel, isSongPage } = useKeyboardShortcuts({
    onToggleTheme: toggleTheme,
  });

  return (
    <KeyboardShortcuts
      open={showPanel}
      onClose={() => setShowPanel(false)}
      isSongPage={isSongPage}
    />
  );
}
