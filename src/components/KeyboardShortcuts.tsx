"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUTS, type ShortcutEntry } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
  isSongPage: boolean;
}

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-background border border-border rounded-md text-xs font-mono font-medium text-foreground shadow-[0_1px_0_1px] shadow-border/50">
      {children}
    </kbd>
  );
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <span className="text-sm text-foreground-secondary group-hover:text-foreground transition-colors">
        {entry.label}
      </span>
      <ShortcutKey>{entry.key}</ShortcutKey>
    </div>
  );
}

export default function KeyboardShortcuts({ open, onClose, isSongPage }: KeyboardShortcutsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Focus trap + escape
  useEffect(() => {
    if (!open) return;

    const prevFocus = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
  }, [open, onClose]);

  const globalShortcuts = SHORTCUTS.filter((s) => s.scope === "global");
  const songShortcuts = SHORTCUTS.filter((s) => s.scope === "song");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdrop}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            tabIndex={-1}
            className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl focus:outline-none overflow-hidden"
            initial={{ scale: 0.92, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Keyboard className="w-4 h-4 text-accent" />
                </div>
                <h3 className="text-foreground font-semibold text-base">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close shortcuts panel"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-background-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5 text-foreground-secondary" />
              </button>
            </div>

            {/* Global shortcuts */}
            <div className="px-5 pb-2">
              <p className="text-[10px] uppercase tracking-widest text-foreground-secondary font-medium mb-1">
                Navigation
              </p>
              <div className="divide-y divide-border">
                {globalShortcuts.map((s) => (
                  <ShortcutRow key={s.key} entry={s} />
                ))}
              </div>
            </div>

            {/* Song page shortcuts */}
            {songShortcuts.length > 0 && (
              <div className="px-5 pb-4 pt-1">
                <p className="text-[10px] uppercase tracking-widest text-foreground-secondary font-medium mb-1">
                  Song Page {!isSongPage && <span className="opacity-50">(when viewing a song)</span>}
                </p>
                <div className={`divide-y divide-border ${!isSongPage ? "opacity-40" : ""}`}>
                  {songShortcuts.map((s) => (
                    <ShortcutRow key={s.key} entry={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer hint */}
            <div className="bg-background-secondary/50 border-t border-border px-5 py-3">
              <p className="text-[11px] text-foreground-secondary text-center">
                Press <ShortcutKey>?</ShortcutKey> or <ShortcutKey>Esc</ShortcutKey> to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
