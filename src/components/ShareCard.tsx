"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Link2, Check, Share2 } from "lucide-react";
import { SongData } from "@/types";
import SafeImage from "./SafeImage";

interface ShareCardProps {
  song: SongData;
  onClose: () => void;
}

export default function ShareCard({ song, onClose }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + Escape key + restore focus on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the dialog container on mount
    const timer = requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap: cycle Tab within the modal
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareToX = () => {
    const text = `Check out "${song.title}" by ${song.artist} on Music Time Machine!`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank"
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${song.title}`}
        tabIndex={-1}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl focus:outline-none"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-accent" />
            <h3 className="text-foreground font-semibold text-lg">Share Song</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-secondary transition-colors"
          >
            <X className="w-4 h-4 text-foreground-secondary" />
          </button>
        </div>

        {/* Song Preview */}
        <div className="bg-background-secondary rounded-xl p-3 mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-background-secondary flex-shrink-0 overflow-hidden">
            {song.albumArt && (
              <SafeImage src={song.albumArt} alt={song.title} width={48} height={48} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-medium text-sm truncate">{song.title}</p>
            <p className="text-foreground-secondary text-xs truncate">{song.artist}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-3 rounded-xl font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={shareToX}
              className="flex items-center justify-center gap-2 bg-background-secondary hover:bg-card-hover border border-border py-2.5 rounded-xl text-foreground text-sm font-medium transition-colors"
            >
              Share on X
            </button>
            <button
              onClick={shareToFacebook}
              className="flex items-center justify-center gap-2 bg-background-secondary hover:bg-card-hover border border-border py-2.5 rounded-xl text-foreground text-sm font-medium transition-colors"
            >
              Facebook
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
