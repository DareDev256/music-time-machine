"use client";

// The real thumbnail until someone presses play; only then does the player iframe load.
// Keeps the era page light and crawlable, and loads nothing from YouTube for people who only read.

import { useState } from "react";

export default function YouTubeFacade({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  return (
    <div style={{ position: "relative", aspectRatio: "16 / 9", width: "100%", maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--hair)" }}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title} on YouTube`}
          style={{ position: "absolute", inset: 0, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(0.9)" }}
          />
          <span
            style={{
              position: "absolute", left: 16, bottom: 16, display: "inline-flex", alignItems: "center", gap: 10,
              background: "#000", color: "var(--ink)", border: "1px solid var(--signal)", padding: "10px 14px",
              font: "600 12px var(--font-mono)", letterSpacing: "0.2em", textTransform: "uppercase",
            }}
          >
            <span aria-hidden style={{ width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid var(--signal)" }} />
            Play the upload
          </span>
        </button>
      )}
    </div>
  );
}
