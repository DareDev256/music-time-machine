"use client";

// The real thumbnail until someone presses play; only then does the player iframe load.
// Keeps the era page light and crawlable, and loads nothing from YouTube for people who only read.

import { useState } from "react";
import c from "./share.module.css";

export default function YouTubeFacade({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  return (
    <div className={c.video}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className={c.frame}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title} on YouTube`}
          className={c.poster}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
          <span className={c.play}>
            <span aria-hidden className={c.tri} />
            Play the upload
          </span>
        </button>
      )}
    </div>
  );
}
