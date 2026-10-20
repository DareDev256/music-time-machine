"use client";

// One tap to share: on phones the story card goes out as an image with the replay link;
// on desktop, copy the link or save the card.

import { useState } from "react";

export default function ShareBar({
  line, replayUrl, storyUrl, wideUrl, fileName,
}: {
  line: { season: string; me: string; world: string };
  replayUrl: string; storyUrl: string; wideUrl: string; fileName: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const text = [line.season, line.me, line.world].filter(Boolean).join(" · ");

  async function share() {
    try {
      const res = await fetch(storyUrl);
      const blob = await res.blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: replayUrl });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url: replayUrl });
        return;
      }
      await copy();
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${replayUrl}`);
      setNote("Link copied");
    } catch {
      setNote(replayUrl);
    }
  }

  const btn: React.CSSProperties = {
    font: "600 12px var(--font-mono)", letterSpacing: "0.2em", textTransform: "uppercase",
    padding: "14px 16px", border: "1px solid var(--faint)", background: "transparent", color: "var(--ink)", cursor: "pointer",
    textDecoration: "none", display: "inline-flex", alignItems: "center",
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p className="display" style={{ fontSize: "clamp(28px, 6vw, 64px)", margin: 0, textWrap: "balance" }}>
        <span style={{ color: "var(--signal)" }}>{line.season}</span>
        {line.me && <> · {line.me}</>}
        {line.world && <> · <span style={{ color: "var(--dim)" }}>{line.world}</span></>}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={share} style={{ ...btn, background: "var(--signal)", color: "#000", borderColor: "var(--signal)" }}>
          Share this era
        </button>
        <button type="button" onClick={copy} style={btn}>Copy the link</button>
        <a href={storyUrl} download={`${fileName}-story.png`} style={btn}>Story card</a>
        <a href={wideUrl} download={`${fileName}.png`} style={btn}>Wide card</a>
      </div>
      <p className="label" aria-live="polite" style={{ minHeight: 14, margin: 0, wordBreak: "break-all" }}>
        {note ?? "The link replays the flight back to this week."}
      </p>
    </div>
  );
}
