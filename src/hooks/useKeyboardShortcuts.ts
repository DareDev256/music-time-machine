"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface ShortcutEntry {
  key: string;
  label: string;
  scope: "global" | "song";
}

export const SHORTCUTS: ShortcutEntry[] = [
  { key: "/", label: "Focus search", scope: "global" },
  { key: "?", label: "Toggle shortcuts panel", scope: "global" },
  { key: "h", label: "Go home", scope: "global" },
  { key: "t", label: "Toggle theme", scope: "global" },
  { key: "s", label: "Share song", scope: "song" },
  { key: "c", label: "Compare this song", scope: "song" },
  { key: "Esc", label: "Close panel / deselect", scope: "global" },
];

/**
 * Global keyboard shortcuts for power-user navigation.
 * Ignores keypresses when the user is typing in an input/textarea/contenteditable.
 */
export function useKeyboardShortcuts({
  onToggleTheme,
}: {
  onToggleTheme?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showPanel, setShowPanel] = useState(false);
  const isSongPage = pathname.startsWith("/song/");

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;

      // Don't intercept when typing in form fields
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      ) {
        // Exception: Escape should still work inside inputs
        if (e.key === "Escape") {
          (target as HTMLInputElement).blur();
          setShowPanel(false);
        }
        return;
      }

      // Don't intercept modified keys (Ctrl/Cmd/Alt combos)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/": {
          e.preventDefault();
          // Find the search input and focus it
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[type="text"][placeholder*="Search"]'
          );
          searchInput?.focus();
          break;
        }
        case "?": {
          e.preventDefault();
          setShowPanel((prev) => !prev);
          break;
        }
        case "Escape": {
          setShowPanel(false);
          break;
        }
        case "h": {
          if (pathname !== "/") router.push("/");
          break;
        }
        case "t": {
          onToggleTheme?.();
          break;
        }
        case "s": {
          if (isSongPage) {
            document.dispatchEvent(new CustomEvent("mtm:share"));
          }
          break;
        }
        case "c": {
          if (isSongPage) {
            document.dispatchEvent(new CustomEvent("mtm:compare"));
          }
          break;
        }
      }
    },
    [pathname, router, onToggleTheme, isSongPage]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return {
    showPanel,
    setShowPanel,
    isSongPage,
  };
}
