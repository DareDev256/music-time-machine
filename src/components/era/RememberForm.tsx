"use client";

// "Remember something from {Month Year}?" A listener names a song that was hot that month; it is
// fact-checked server-side and goes live only after a moderator approves it. Posts to /api/submit.

import { useId, useState, type FormEvent } from "react";
import s from "./RememberForm.module.css";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; verdict: string }
  | { kind: "error"; message: string };

export default function RememberForm({ month, monthLabel }: { month: string; monthLabel: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [noteLen, setNoteLen] = useState(0);
  const id = useId();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const body = {
      song: text("song"),
      artist: text("artist"),
      month,
      note: text("note") || undefined,
      link: text("link") || undefined,
      website: text("website"),
    };
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; verdict?: string; error?: string };
      if (res.ok && data.ok) setState({ kind: "done", verdict: data.verdict ?? "unverified" });
      else setState({ kind: "error", message: data.error ?? "Couldn't send that. Try again in a minute." });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Try again in a minute." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className={s.wrap} aria-live="polite">
        <p className={s.thanks}>Thanks. It goes live once it&rsquo;s checked.</p>
        {state.verdict === "blew-up-later" && <p className={s.aside}>Released earlier, remembered now: that&rsquo;s allowed.</p>}
        <button type="button" className={s.again} onClick={() => { setNoteLen(0); setState({ kind: "idle" }); }}>Send another</button>
      </div>
    );
  }

  return (
    <form className={s.wrap} onSubmit={onSubmit} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className={s.heading}>Remember something from {monthLabel}?</h3>
      <p className={s.sub}>Name a song that was hot then, even if it came out years earlier. We check it before it shows.</p>

      <div className={s.row}>
        <label className={s.field}>
          <span className={s.label}>Song</span>
          <input name="song" required maxLength={120} autoComplete="off" spellCheck={false} />
        </label>
        <label className={s.field}>
          <span className={s.label}>Artist</span>
          <input name="artist" required maxLength={120} autoComplete="off" spellCheck={false} />
        </label>
      </div>

      <label className={s.field}>
        <span className={s.label}>Where can we hear it? <em>optional</em></span>
        <input name="link" type="url" inputMode="url" maxLength={400} autoComplete="off" placeholder="YouTube, SoundCloud, Bandcamp…" />
      </label>

      <label className={s.field}>
        <span className={s.label}>Note <em>optional · {280 - noteLen} left</em></span>
        <textarea name="note" rows={2} maxLength={280} onChange={(e) => setNoteLen(e.currentTarget.value.length)} />
      </label>

      {/* Honeypot: hidden from people and screen readers; bots fill it, and the server drops those. */}
      <div className={s.trap} aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className={s.actions}>
        <button type="submit" className={s.send} disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Checking…" : "Send it in"}
        </button>
        {state.kind === "error" && <p className={s.error} role="alert">{state.message}</p>}
      </div>
    </form>
  );
}
