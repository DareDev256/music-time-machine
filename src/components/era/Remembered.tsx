// "Remembered by listeners": approved submissions for one month, as a hairline list in the era
// page's off-chart style. Server component; renders nothing at all when the month has none.

import { rememberedFor } from "@/lib/era/remembered";
import { verdictNote } from "@/lib/era/verdict";
import s from "./Remembered.module.css";

export default async function Remembered({ month }: { month: string }) {
  const rows = await rememberedFor(month);
  if (!rows.length) return null;
  return (
    <section className={s.section} aria-labelledby={`remembered-${month}`}>
      <div className={s.head}>
        <h2 id={`remembered-${month}`} className={s.h2}>Remembered by listeners</h2>
        <span className={s.source}>Sent in by people who were there, checked against MusicBrainz, Apple and the charts before it shows. A song can be hot years after it came out.</span>
      </div>
      <ol className={s.list}>
        {rows.map((r, i) => (
          <li key={`${r.song}|${r.artist}|${i}`}>
            <span className={s.n}>{String(i + 1).padStart(2, "0")}</span>
            <span className={s.body}>
              <span className={s.song}>{r.song}</span>
              <span className={s.by}>{r.artist}</span>
              <span className={s.verdict}>{verdictNote(r.verdict, r.earliest)}</span>
              {r.note && <span className={s.note}>&ldquo;{r.note}&rdquo;</span>}
            </span>
            {r.link && (
              <a className={s.listen} href={r.link} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`Listen to ${r.song} by ${r.artist}`}>
                Listen ↗
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
