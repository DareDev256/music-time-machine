"use client";

// The home screen: one input, the timeline tree behind it, and the flight back to a week.
// Resolve happens in the browser (MusicBrainz and iTunes are CORS-open, so their limits are per
// visitor). A failed resolve never blocks the flight: it offers the year and flies anyway.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Readout, { segDate, plainDate } from "@/components/Readout";
import type { FlightBranch, PassingWeek } from "@/components/flight/Flight";
import { browserDeps, resolveQuery } from "@/lib/era/resolve";
import { flightTarget, localToday, extractDateDetail, CHART_START } from "@/lib/era/dates";
import type { DatedSong, Granularity } from "@/lib/era/types";
import s from "./console.module.css";

const Flight = dynamic(() => import("@/components/flight/Flight"), { ssr: false });

type Phase = "idle" | "resolving" | "picking" | "flying" | "landed";
interface Destination { date: string; granularity: Granularity; song?: DatedSong; born?: boolean; label?: string }

const CHIPS: Array<{ label: string; q?: string; born?: boolean }> = [
  { label: "Cuz My Gear · 2012", q: "Cuz My Gear Chief Keef" },
  { label: "Rolling in the Deep · 2011", q: "Rolling in the Deep Adele" },
  { label: "The day you were born", born: true },
  { label: "Summer 1999", q: "summer 1999" },
];

const LAND_HOLD_MS = 2400;

function eraUrl(d: Destination): string {
  const p = new URLSearchParams({ date: d.date });
  if (d.song) {
    p.set("song", d.song.song);
    p.set("artist", d.song.artist);
    if (d.song.dateSource) p.set("ds", d.song.dateSource);
    if (d.song.youtubeId) p.set("y", d.song.youtubeId);
  }
  if (d.born) p.set("born", "1");
  return `/era/${d.date.slice(0, 7)}?${p}`;
}

export default function Console({
  initial, freeze,
}: {
  initial: { to?: string; song?: string; artist?: string; born?: boolean } | null;
  freeze?: number;
}) {
  const router = useRouter();
  const today = useMemo(() => localToday(), []);
  // A shared link (/?to=…&song=…) replays the flight straight away: seed the state from it.
  const [dest, setDest] = useState<Destination | null>(() => {
    if (!initial?.to) return null;
    const song = initial.song && initial.artist
      ? { song: initial.song, artist: initial.artist, date: initial.to, granularity: "day" as Granularity, dateSource: "", where: [], onDsp: null }
      : undefined;
    const date = initial.to < CHART_START ? CHART_START : initial.to > today ? today : initial.to;
    return { date, granularity: "day", song, born: initial.born };
  });
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase>(() => (initial?.to ? "flying" : "idle"));
  const [candidates, setCandidates] = useState<DatedSong[]>([]);
  const [yearOption, setYearOption] = useState<{ date: string; granularity: Granularity; label: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [askYear, setAskYear] = useState(false);
  const [bornOpen, setBornOpen] = useState(false);
  const [passing, setPassing] = useState<PassingWeek | null>(null);
  const [branches, setBranches] = useState<FlightBranch[] | undefined>(undefined);
  const [skip, setSkip] = useState(0);
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fly = useCallback((d: Destination) => {
    const date = d.date < CHART_START ? CHART_START : d.date > today ? today : d.date;
    setDest({ ...d, date });
    setCandidates([]);
    setYearOption(null);
    setAskYear(false);
    setMessage(null);
    setBranches(undefined);
    setPhase("flying");
  }, [today]);

  // Label the tree's branches at the destination with that week's lane #1s.
  useEffect(() => {
    if (!dest) return;
    let live = true;
    const mine = dest.song ? dest.song.artist.toLowerCase().split(/\s+(?:&|x|featuring|feat\.?|ft\.?)\s+/)[0] : null;
    fetch(`/api/week?date=${dest.date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: { lanes?: { lane: string; label: string; song: string; artist: string }[] } | null) => {
        if (live && w?.lanes) setBranches(w.lanes.map((l) => ({ ...l, mine: !!mine && l.artist.toLowerCase().includes(mine) })));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [dest]);

  const launchSong = useCallback((song: DatedSong) => {
    fly({ date: flightTarget(song.date, song.granularity), granularity: song.granularity, song });
  }, [fly]);

  async function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    setPhase("resolving");
    setMessage(null);
    const out = await resolveQuery(t, browserDeps());
    if (out.kind === "song") {
      if (out.needsPick) {
        // "1999" is both Prince's song and a year: offer both, never guess.
        const asDate = extractDateDetail(t);
        const yearOpt = asDate && !asDate.rest.trim() ? { date: asDate.date, granularity: asDate.granularity, label: asDate.label } : null;
        if (out.candidates.length > 1 || yearOpt) {
          setCandidates(out.candidates.slice(0, 3));
          setYearOption(yearOpt);
          setPhase("picking");
          return;
        }
      }
      launchSong(out.best);
    } else if (out.kind === "date") {
      fly({ date: flightTarget(out.date, out.granularity), granularity: out.granularity, label: out.label });
    } else {
      setPhase("idle");
      setMessage(out.reason || "Couldn't place that one.");
      setAskYear(true);
    }
  }

  const onArrive = useCallback(() => {
    setPhase("landed");
    if (freeze !== undefined) return;
    landTimer.current = setTimeout(() => { if (dest) router.push(eraUrl(dest)); }, LAND_HOLD_MS);
  }, [dest, freeze, router]);

  useEffect(() => () => { if (landTimer.current) clearTimeout(landTimer.current); }, []);
  useEffect(() => { if (dest) router.prefetch(eraUrl(dest)); }, [dest, router]);

  const flying = phase === "flying" || phase === "landed";

  return (
    <div className={s.root} data-phase={phase}>
      <Flight target={dest?.date ?? null} onPassing={setPassing} onArrive={onArrive} freeze={freeze} skipSignal={skip} branches={branches} />

      <div className={s.hud}>
        <header className={s.top}>
          <div className={s.brand}>
            <span className={s.word}>Was<b>·</b>Playing</span>
            <span className="label">The music time machine</span>
          </div>
          <div className={s.readouts}>
            <Readout label="Destination" value={segDate(dest?.date)} align="inherit" />
            <Readout label={flying ? "Now passing" : "Present"} value={segDate(flying ? passing?.date ?? today : today)} tone="ink" size="md" align="inherit" />
          </div>
        </header>

        <div className={s.middle} aria-live="polite">
          {flying && passing && (
            <div className={s.passing}>
              <span className="label">{phase === "landed" ? "Arrived · #1 on the Hot 100" : "#1 on the Hot 100"}</span>
              <p className={s.passTitle}>{passing.song}</p>
              <span className={s.passArtist}>{passing.artist}</span>
              <span className={s.passRun}>Week {passing.runWeek} of {passing.runLength} at #1</span>
            </div>
          )}
          {phase === "landed" && dest && (
            <button type="button" className={s.enter} onClick={() => router.push(eraUrl(dest))}>
              {dest.song ? `Enter ${dest.song.song}'s era` : `Enter ${plainDate(dest.date)}`} →
            </button>
          )}
        </div>

        <div className={s.console}>
          {phase === "picking" && (
            <div className={s.picker} role="list" aria-label="Which one?">
              <span className="label">Which one did you mean?</span>
              {yearOption && (
                <button type="button" role="listitem" className={s.pick} onClick={() => fly({ date: flightTarget(yearOption.date, yearOption.granularity), granularity: yearOption.granularity, label: yearOption.label })}>
                  <span className={s.pickTitle}>{yearOption.label}</span>
                  <span className={s.pickMeta}>The year, not a song</span>
                </button>
              )}
              {candidates.map((c) => (
                <button key={`${c.song}|${c.artist}|${c.date}`} type="button" role="listitem" className={s.pick} onClick={() => launchSong(c)}>
                  <span className={s.pickTitle}>{c.song}</span>
                  <span className={s.pickMeta}>{c.artist} · {c.dateSource} {plainDate(c.date)}</span>
                </button>
              ))}
            </div>
          )}

          {message && <p className={s.message}>{message}</p>}
          {askYear && (
            <form className={s.yearForm} onSubmit={(e) => { e.preventDefault(); const y = new FormData(e.currentTarget).get("year"); if (y) fly({ date: `${y}-06-15`, granularity: "year" }); }}>
              <label htmlFor="year" className="label">Pick the year instead</label>
              <input id="year" name="year" type="number" min={1958} max={Number(today.slice(0, 4))} defaultValue={2012} className={s.yearInput} />
              <button type="submit" className={s.go}>Fly</button>
            </form>
          )}

          {bornOpen ? (
            <form className={s.form} onSubmit={(e) => { e.preventDefault(); const d = String(new FormData(e.currentTarget).get("born") ?? ""); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) fly({ date: d, granularity: "day", born: true }); }}>
              <label htmlFor="born" className={s.srOnly}>Your birthday</label>
              <input id="born" name="born" type="date" min={CHART_START} max={today} required className={s.input} />
              <button type="submit" className={s.go}>Go</button>
            </form>
          ) : (
            <form className={s.form} onSubmit={(e) => { e.preventDefault(); submit(q); }}>
              <label htmlFor="q" className={s.srOnly}>A song, an artist and year, or a date</label>
              <input
                id="q" value={q} onChange={(e) => setQ(e.target.value)} className={s.input}
                placeholder="What were you playing?" autoComplete="off" spellCheck={false} maxLength={200}
              />
              <button type="submit" className={s.go} disabled={phase === "resolving"}>{phase === "resolving" ? "…" : "Go"}</button>
            </form>
          )}
          <div className={s.chips}>
            {CHIPS.map((c) => (
              <button
                key={c.label} type="button" className={s.chip}
                onClick={() => { if (c.born) { setBornOpen(true); return; } setBornOpen(false); setQ(c.q!); submit(c.q!); }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className={s.src}>A song, an artist and a year, or a date. Charts from the Hot 100 since 1958; songs that were never on Spotify or Apple too.</p>
        </div>
      </div>

      {flying && phase !== "landed" && (
        <button type="button" className={s.skip} onClick={() => setSkip((n) => n + 1)}>Skip ›</button>
      )}
    </div>
  );
}
