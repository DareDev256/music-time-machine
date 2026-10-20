"use client";

// One tap to share: on phones the story card goes out as an image with the replay link;
// on desktop, copy the link or save the card.

import { useState } from "react";
import c from "./share.module.css";

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

  return (
    <div className={c.wrap}>
      <p className={`display ${c.line}`}>
        <span className={c.season}>{line.season}</span>
        {line.me && <> · {line.me}</>}
        {line.world && <> · <span className={c.world}>{line.world}</span></>}
      </p>
      <div className={c.buttons}>
        <button type="button" onClick={share} className={`${c.btn} ${c.primary}`}>Share this era</button>
        <button type="button" onClick={copy} className={c.btn}>Copy the link</button>
        <a href={storyUrl} download={`${fileName}-story.png`} className={c.btn}>Story card</a>
        <a href={wideUrl} download={`${fileName}.png`} className={c.btn}>Wide card</a>
      </div>
      <p className={`label ${c.note}`} aria-live="polite">
        {note ?? "The link replays the flight back to this week."}
      </p>
    </div>
  );
}
