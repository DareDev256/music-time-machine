import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import s from "./era.module.css";
import Readout, { segDate, plainDate, monthName } from "@/components/Readout";
import YouTubeFacade from "@/components/era/YouTubeFacade";
import ShareBar from "@/components/era/ShareBar";
import Remembered from "@/components/era/Remembered";
import RememberForm from "@/components/era/RememberForm";
import Industry from "@/components/era/Industry";
import {
  weekNearest, lanesOn, heatFor, heatMonthSpan, redditFor, youtubeFor, numberOneOn, numberOnesThrough, chartsThrough, weeksInMonth,
  indexRow, coverFor, art, addDays, normTitle, primaryArtist, industryFor, type ChartRow, type HeatSource, type YouTubeRow, type YouTubeSource,
} from "@/lib/era/data";
import { cardLine } from "@/lib/era/cardLine";
import { coverArtFor } from "@/lib/coverArt";

const CHART_START = "1958-08-04";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://music-time-machine.vercel.app";

type Params = Promise<{ month: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function clean(v: string | string[] | undefined, max = 120): string | null {
  const one = Array.isArray(v) ? v[0] : v;
  if (!one) return null;
  const t = one.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return t || null;
}

function validMonth(month: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  return month >= CHART_START.slice(0, 7) && month <= chartsThrough().slice(0, 7);
}

/** The day the page is about: the anchor's date when it falls in this month, else the month's last chart week. */
function pageDate(month: string, dateParam: string | null): string {
  const last = chartsThrough();
  let d = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam.startsWith(month) ? dateParam : null;
  if (!d) d = weeksInMonth(month).at(-1) ?? `${month}-15`;
  if (d < CHART_START) d = CHART_START;
  if (d > last) d = last;
  return d;
}

function eraHref(month: string, q: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const qs = p.toString();
  return `/era/${month}${qs ? `?${qs}` : ""}`;
}

function shiftMonth(month: string, by: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function movement(r: ChartRow) {
  if (r.new) return <span className={s.new}>NEW</span>;
  if (r.last === null) return <span>–</span>;
  if (r.last > r.rank) return <span className={s.up}>▲ {r.last - r.rank}</span>;
  if (r.last < r.rank) return <span>▼ {r.rank - r.last}</span>;
  return <span>=</span>;
}


const views = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

function YouTubeColumn({ src, isMine }: { src: YouTubeSource; isMine: (artist: string) => boolean }) {
  const row = (r: YouTubeRow) => (
    <li key={r.videoId} className={isMine(r.artist) ? s.hit : undefined}>
      <span className={s.heatRank}>{String(r.rank).padStart(2, "0")}</span>
      <span>
        <span className={s.song}>{r.song}</span>
        <span className={s.by}>{r.artist}</span>
        <a className={s.thread} href={`https://www.youtube.com/watch?v=${r.videoId}`} target="_blank" rel="noopener noreferrer nofollow">
          {views(r.views)} views · {plainDate(r.published)} ↗
        </a>
      </span>
    </li>
  );
  return (
    <div className={s.heatCol}>
      <div className={s.heatHead}>
        <span className={s.heatLabel}>{src.label}</span>
        <a className={s.source} href={src.channel} target="_blank" rel="noopener noreferrer">{src.genre} · channel ↗</a>
      </div>
      <ol className={s.heatList}>{src.rows.slice(0, 3).map(row)}</ol>
      {src.rows.length > 3 && (
        <details className={s.more}>
          <summary>{Math.min(src.rows.length, 12) - 3} more</summary>
          <ol className={s.heatList} start={4}>{src.rows.slice(3, 12).map(row)}</ol>
        </details>
      )}
    </div>
  );
}

function HeatColumn({ src, isMine }: { src: HeatSource; isMine: (artist: string) => boolean }) {
  return (
    <div className={s.heatCol}>
                <div className={s.heatHead}>
                  <span className={s.heatLabel}>{src.label.replace(/\s*\(.*\)\s*$/, "")}</span>
                  <span className={s.source}>
                    {src.list === "front" ? "Front page, newest first. " : ""}
                    <a href={src.capture} target="_blank" rel="noopener noreferrer">Archived {plainDate(src.captured)} ↗</a>
                  </span>
                </div>
                <ol className={s.heatList}>
                  {src.rows.slice(0, 5).map((r) => (
                    <li key={`${src.id}-${r.rank}`} className={isMine(r.artist) ? s.hit : undefined}>
                      <span className={s.heatRank}>{src.list === "front" ? "·" : String(r.rank).padStart(2, "0")}</span>
                      <span><span className={s.song}>{r.song}</span><span className={s.by}>{r.artist}</span></span>
                    </li>
                  ))}
                </ol>
                {src.rows.length > 5 && (
                  <details className={s.more}>
                    <summary>{Math.min(src.rows.length, 20) - 5} more</summary>
                    <ol className={s.heatList} start={6}>
                      {src.rows.slice(5, 20).map((r) => (
                        <li key={`${src.id}-${r.rank}`} className={isMine(r.artist) ? s.hit : undefined}>
                          <span className={s.heatRank}>{src.list === "front" ? "·" : String(r.rank).padStart(2, "0")}</span>
                          <span><span className={s.song}>{r.song}</span><span className={s.by}>{r.artist}</span></span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
  );
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { month } = await params;
  if (!validMonth(month)) return { title: "Was Playing" };
  const sp = await searchParams;
  const song = clean(sp.song), artist = clean(sp.artist);
  const date = pageDate(month, clean(sp.date, 10));
  const n1 = numberOneOn(date);
  const title = song ? `${song} · ${monthName(month)} · Was Playing` : `${monthName(month)} · Was Playing`;
  const description = n1
    ? `The week of ${plainDate(date)}: ${n1.song} by ${n1.artist} was #1. The charts, the lanes and what the internet was playing.`
    : `What was playing in ${monthName(month)}.`;
  const card = `/api/card?${new URLSearchParams({ ...(song ? { song } : {}), ...(artist ? { artist } : {}), date, format: "wide" })}`;
  return {
    title, description,
    alternates: { canonical: `/era/${month}` },
    openGraph: { title, description, images: [{ url: card, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

export default async function EraPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { month } = await params;
  if (!validMonth(month)) notFound();
  const sp = await searchParams;

  const song = clean(sp.song);
  const artist = clean(sp.artist);
  const dateParam = clean(sp.date, 10);
  const date = pageDate(month, dateParam);
  const born = clean(sp.born, 1) === "1";

  // The anchor: the index is the authority when it knows the song; the URL only fills gaps.
  const row = song && artist ? indexRow(song, artist) : null;
  // The resolver's pick (sd + ds from the console) wins over the index row: the resolver already chose
  // the earliest credible date across sources, while the row holds only one source's first sighting.
  const sdParam = clean(sp.sd, 10);
  const sd = sdParam && /^\d{4}-\d{2}-\d{2}$/.test(sdParam) ? sdParam : null;
  const dsParam = clean(sp.ds, 60);
  const anchorDate = sd ?? row?.d ?? (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null);
  const dateSource = sd && dsParam ? dsParam : row?.ds ?? dsParam;
  const ytParam = clean(sp.y, 11);
  const youtubeId = row?.y ?? (ytParam && /^[A-Za-z0-9_-]{11}$/.test(ytParam) ? ytParam : null);
  const note = row?.n ?? null;
  const anchorArt = song && artist && !youtubeId
    ? art(coverFor(song, artist), 600) ?? (await coverArtFor(song, artist).catch(() => null))?.url ?? null
    : null;

  const week = weekNearest(date);
  const n1 = numberOneOn(date);
  const lanes = lanesOn(date);
  const heatAll = heatFor(month);
  // Archived Billboard pages are charts, not the internet: they go with their lane, not "off the charts".
  const BILLBOARD_LANE: Record<string, string> = { billboard_rap: "rap", billboard_rnb: "rnb_hiphop", billboard_country: "country", billboard_dance: "dance", billboard_alt: "rock_alt" };
  const archivedTop10 = new Map((heatAll?.sources ?? []).filter((x) => BILLBOARD_LANE[x.id]).map((x) => [BILLBOARD_LANE[x.id], x]));
  const heatSources = (heatAll?.sources ?? []).filter((x) => !BILLBOARD_LANE[x.id]);
  const heat = heatSources.length ? { ...heatAll!, sources: heatSources } : null;
  // What a visitor recognises first: the blogs and Hype Machine, then critics, then the streaming-era charts.
  const HEAT_ORDER = ["hotnewhiphop", "hypem", "pitchfork_bnt", "spotify_viral", "kworb_spotify_us", "blog_2dopeboyz", "blog_pigeonsandplanes", "beatport_top100", "kworb_itunes_us"];
  const rank = (id: string) => { const i = HEAT_ORDER.indexOf(id); return i < 0 ? HEAT_ORDER.length : i; };
  const heatOrdered = [...heatSources].sort((a, b) => rank(a.id) - rank(b.id));
  const redditCount = redditFor(month)?.length ?? 0;
  const heatVisible = heatOrdered.slice(0, Math.max(1, 4 - redditCount));
  const heatExtra = heatOrdered.slice(heatVisible.length);
  const heatSpan = heatMonthSpan();
  const reddit = redditFor(month);
  const yt = youtubeFor(month);
  const through = chartsThrough();
  const line = cardLine({ song, artist, date, numberOne: n1 });
  const conceived = born ? numberOneOn(addDays(date, -266)) : null;
  const industry = industryFor(Number(month.slice(0, 4)));

  // Declared before the verdict below uses it (a later const here is a runtime ReferenceError, not a type error).
  const mine = artist ? normTitle(primaryArtist(artist)) : null;
  const isMine = (a: string) => !!mine && mine.length > 2 && normTitle(a).includes(mine);

  // Where was the visitor's song that week? The first answer a returning visitor wants.
  const songKey = song ? normTitle(song) : null;
  const sameSong = (t: string) => !!songKey && songKey.length > 1 && (normTitle(t) === songKey || normTitle(t).startsWith(songKey) || songKey.startsWith(normTitle(t)));
  const onChart = song ? week?.top.find((r) => sameSong(r.song) && isMine(r.artist)) : undefined;
  const laneHits = song ? lanes.filter((l) => sameSong(l.song) && isMine(l.artist)) : [];
  const heatHit = song ? (heat?.sources ?? []).flatMap((x) => x.rows.map((r) => ({ x, r }))).find(({ r }) => sameSong(r.song) && isMine(r.artist)) : undefined;
  const redditHit = song ? (redditFor(month) ?? []).flatMap((x) => x.rows.map((r) => ({ x, r }))).find(({ r }) => sameSong(r.song) && isMine(r.artist)) : undefined;
  const ytHit = song && yt ? yt.sources.flatMap((x) => x.rows.map((r) => ({ x, r }))).find(({ r }) => sameSong(r.song) && isMine(r.artist)) : undefined;
  // The channels that broke songs. The visitor's channel leads, then its scene; then one channel per genre, loudest
  // first, so a Chicago drill month is not led by a K-pop label on raw views alone.
  const ytTotal = (x: YouTubeSource) => x.rows.slice(0, 5).reduce((n, r) => n + r.views, 0);
  const byViews = yt ? [...yt.sources].sort((a, b) => ytTotal(b) - ytTotal(a)) : [];
  const firstOfGenre = byViews.filter((x, i) => byViews.findIndex((y) => y.genre === x.genre) === i);
  const spread = [...firstOfGenre, ...byViews.filter((x) => !firstOfGenre.includes(x))];
  const ytOrdered = ytHit
    ? [ytHit.x, ...spread.filter((x) => x !== ytHit.x && x.genre === ytHit.x.genre), ...spread.filter((x) => x !== ytHit.x && x.genre !== ytHit.x.genre)]
    : spread;
  const ytVisible = ytOrdered.slice(0, 4);
  const ytExtra = ytOrdered.slice(4);
  const verdict = !song ? null
    : onChart ? `#${onChart.rank} on the Hot 100 that week${laneHits.length ? `, and #1 on ${laneHits.map((l) => l.label).join(" and ")}` : ""}.`
    : laneHits.length ? `#1 on ${laneHits.map((l) => l.label).join(" and ")} that week; not in the Hot 100 top 10.`
    : heatHit ? `Not in the Hot 100 top 10. On ${heatHit.x.label.replace(/\s*\(.*\)\s*$/, "")}${heatHit.x.list === "ranked" ? ` at #${heatHit.r.rank}` : ""} that month.`
    : redditHit ? `Not in the Hot 100 top 10. On ${redditHit.x.id} with ${redditHit.r.score.toLocaleString("en-US")} upvotes that month.`
    : ytHit ? `Not in the Hot 100 top 10. Uploaded by ${ytHit.x.label} that month: ${views(ytHit.r.views)} views since.`
    : n1 ? `Not in the Hot 100 top 10 that week. The #1 was ${n1.song} by ${n1.artist}.` : null;

  const anchorQ = { song, artist, sd: sd ?? undefined, ds: sd ? dsParam : undefined };
  const cardQ = new URLSearchParams({ ...(song ? { song } : {}), ...(artist ? { artist } : {}), date });
  const replay = `${SITE}/?${new URLSearchParams({ to: date, ...(song ? { song } : {}), ...(artist ? { artist } : {}) })}`;

  return (
    <div className={s.page}>
      <header className={s.mast}>
        <Link href="/" className={s.word}>Was<b>·</b>Playing</Link>
        <Link href="/" className={s.fly}>Fly somewhere else</Link>
      </header>

      <section className={s.hero} aria-labelledby="era-title">
        <div className={s.heroText}>
          <span className="label">{song ? "You were playing" : born ? "The week you were born" : "The week of"}</span>
          <h1 id="era-title" className={s.title}>{song ?? plainDate(date)}</h1>
          {song && artist && <span className={s.artist}>{artist}</span>}
          {verdict && <p className={s.verdict}>{verdict}</p>}
          <ul className={s.facts}>
            {song && anchorDate && dateSource && (
              <li><span><span className={s.factStrong}>{dateSource}</span> · {plainDate(anchorDate)}</span></li>
            )}
            {note && <li><span>{note}</span></li>}
            {!song && n1 && (
              <li><span>The #1 on the Hot 100: <span className={s.factStrong}>{n1.song}</span> by {n1.artist}, week {n1.runWeek}{n1.ongoing ? ", still running" : ` of ${n1.runLength}`}.</span></li>
            )}
            {conceived && (
              <li><span>38 weeks earlier, the #1 was <span className={s.factStrong}>{conceived.song}</span> by {conceived.artist}.</span></li>
            )}
          </ul>
        </div>

        <div className={s.heroSide}>
          <div className={s.readouts}>
            <Readout label="Destination" value={segDate(date)} align="start" />
            {week && week.date !== date && <Readout label="Chart week" value={segDate(week.date)} tone="ink" size="md" align="start" />}
          </div>
          {youtubeId && song ? (
            <YouTubeFacade id={youtubeId} title={`${song} by ${artist}`} />
          ) : (song ? anchorArt : art(n1?.art, 600)) ? (
            <div className={s.cover}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={(song ? anchorArt : art(n1?.art, 600))!} alt={song ? `${song} cover` : `${n1?.song} cover`} />
            </div>
          ) : (
            <div className={s.cover}>
              <div className={s.sleeve}>
                <span className={`display ${s.sleeveTitle}`}>{song ?? n1?.song}</span>
                <span className="label">{artist ?? n1?.artist}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {week && (
        <section className={s.section} aria-labelledby="world">
          <div className={s.sectionHead}>
            <h2 id="world" className={s.h2}>{song ? "The world was playing" : "The charts that week"}</h2>
            <span className={s.source}>Billboard Hot 100 dated {plainDate(week.date)}. Top 10 from utdata/rwd-billboard-data (MIT), cross-checked rank by rank against mhollingshead/billboard-hot-100 and on the #1 against Wikipedia. A dash means the two scrapes disagree.</span>
          </div>
          <div className={s.world}>
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr><th>#</th><th>Song</th><th className={s.num}>Move</th><th className={s.num}>Peak</th><th className={s.num}>Wks</th></tr>
                </thead>
                <tbody>
                  {week.top.map((r) => (
                    <tr key={r.rank} className={isMine(r.artist) ? s.hit : undefined}>
                      <td className={`${s.rank} ${r.rank === 1 ? s.rank1 : ""}`}>{String(r.rank).padStart(2, "0")}</td>
                      <td>
                        {r.rank === 1 && song && n1?.art && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={s.rowCover} src={art(n1.art, 160)!} alt="" loading="lazy" />
                        )}
                        <span className={s.song}>{r.song}</span><span className={s.by}>{r.artist}</span>
                        {r.rank === 1 && n1 && <span className={s.run}>Week {n1.runWeek}{n1.ongoing ? " at #1, still running" : ` of ${n1.runLength} at #1`}</span>}
                      </td>
                      <td className={`${s.num} ${s.move}`}>{movement(r)}</td>
                      <td className={s.num}>{r.peak ?? "–"}</td>
                      <td className={s.num}>{r.weeks ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={s.weeks} aria-label={`Chart weeks in ${monthName(month)}`}>
            {weeksInMonth(month).map((w) => (
              <Link key={w} href={eraHref(month, { ...anchorQ, date: w })} aria-current={week.date === w ? "true" : undefined}>{plainDate(w)}</Link>
            ))}
          </div>
        </section>
      )}

      {lanes.length > 0 && (
        <section className={s.section} aria-labelledby="lanes">
          <div className={s.sectionHead}>
            <h2 id="lanes" className={s.h2}>#1 in every lane</h2>
            <span className={s.source}>Charts of {plainDate(week?.date ?? date)}: {[
              lanes.some((l) => !["uk", "canada"].includes(l.lane)) && "Billboard genre charts",
              lanes.some((l) => l.lane === "uk") && "the UK Singles Chart",
              lanes.some((l) => l.lane === "canada") && "the Canadian Hot 100",
            ].filter(Boolean).join(", ")}, from Wikipedia&rsquo;s number-one lists (CC BY-SA 4.0).</span>
          </div>
          <div className={s.lanes}>
            {lanes.map((l) => (
              <div key={l.lane} className={`${s.lane} ${isMine(l.artist) ? s.laneMine : ""}`}>
                <span className="label">{l.label}</span>
                <p className={s.laneTitle}>{l.song}</p>
                <span className={s.laneBy}>{l.artist}</span>
                {l.date !== (week?.date ?? date) && <span className={s.laneDate}>Chart of {plainDate(l.date)}</span>}
                {archivedTop10.get(l.lane) && (
                  <details className={s.more}>
                    <summary>Top {Math.min(10, archivedTop10.get(l.lane)!.rows.length)} that month</summary>
                    <ol className={s.laneTop}>
                      {archivedTop10.get(l.lane)!.rows.slice(0, 10).map((r) => <li key={r.rank}>{r.song} <span className={s.by}>{r.artist}</span></li>)}
                    </ol>
                    <a className={s.thread} href={archivedTop10.get(l.lane)!.capture} target="_blank" rel="noopener noreferrer">Billboard.com, archived {plainDate(archivedTop10.get(l.lane)!.captured)} ↗</a>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {yt && (
        <section className={s.section} aria-labelledby="yt">
          <div className={s.sectionHead}>
            <h2 id="yt" className={s.h2}>Where it broke · {monthName(month)}</h2>
            <span className={s.source}>
              Uploads from {monthName(month)} on the channels that broke songs, ranked by views counted {plainDate(yt.viewsAsOf)}.
              Today&apos;s views, not that month&apos;s: a song that blew up later ranks high here.
            </span>
          </div>
          <div className={s.heat}>
            {ytVisible.map((src) => <YouTubeColumn key={src.id} src={src} isMine={isMine} />)}
          </div>
          {ytExtra.length > 0 && (
            <details className={`${s.more} ${s.moreSources}`}>
              <summary>{ytExtra.length} more {ytExtra.length === 1 ? "channel" : "channels"}</summary>
              <div className={s.heat}>
                {ytExtra.map((src) => <YouTubeColumn key={src.id} src={src} isMine={isMine} />)}
              </div>
            </details>
          )}
        </section>
      )}

      <section className={s.section} aria-labelledby="off">
        {(heat || reddit) && (
          <div className={s.sectionHead}>
            <h2 id="off" className={s.h2}>Off the charts · {monthName(month)}</h2>
            <span className={s.source}>What blogs, Hype Machine and Reddit were playing, from pages saved that month. Each list links its source.</span>
          </div>
        )}
        {heat || reddit ? (
          <>
          <div className={s.heat}>
            {reddit?.map((src) => (
              <div key={src.id} className={s.heatCol}>
                <div className={s.heatHead}>
                  <span className={s.heatLabel}>{src.id} · new releases</span>
                  <span className={s.source}>Posts tagged [FRESH] that month, ranked by upvotes.</span>
                </div>
                <ol className={s.heatList}>
                  {src.rows.slice(0, 8).map((r) => (
                    <li key={r.url} className={isMine(r.artist) ? s.hit : undefined}>
                      <span className={s.heatRank}>{String(r.rank).padStart(2, "0")}</span>
                      <span>
                        <span className={s.song}>{r.song}</span>
                        <span className={s.by}>{r.artist}</span>
                        <a className={s.thread} href={r.url} target="_blank" rel="noopener noreferrer nofollow">↑ {r.score.toLocaleString("en-US")} · {r.comments.toLocaleString("en-US")} comments</a>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {heatVisible.map((src) => <HeatColumn key={src.id} src={src} isMine={isMine} />)}
          </div>
          {heatExtra.length > 0 && (
            <details className={`${s.more} ${s.moreSources}`}>
              <summary>More from {monthName(month)}: {heatExtra.map((x) => x.label.replace(/\s*·.*$/, "").replace(/\s*\(.*\)\s*$/, "")).join(", ")}</summary>
              <div className={s.heat}>
                {heatExtra.map((src) => <HeatColumn key={src.id} src={src} isMine={isMine} />)}
              </div>
            </details>
          )}
          </>
        ) : (
          <p id="off" className={s.emptyNote}>
            {heatSpan && month < heatSpan[0]
              ? `The archive of blogs and music sites starts in ${monthName(heatSpan[0])}. For ${monthName(month)}, the charts are the record.`
              : `Nothing from the blogs was archived for ${monthName(month)}.`}
          </p>
        )}
      </section>

      {industry && (
        <section className={s.section} aria-labelledby="paid">
          <div className={s.sectionHead}>
            <h2 id="paid" className={s.h2}>How people paid for music in {month.slice(0, 4)}</h2>
            <span className={s.source}>US recorded-music revenue by format, RIAA U.S. Sales Database (wholesale).{industry.globalStreaming !== null ? " Global streaming share: IFPI Global Music Report." : ""}</span>
          </div>
          <Industry data={industry} />
        </section>
      )}

      <Remembered month={month} />
      <section className={s.section} aria-label={`Remember something from ${monthName(month)}`}>
        <RememberForm month={month} monthLabel={monthName(month)} />
      </section>

      <section className={s.section} aria-label="Share">
        <ShareBar
          line={line}
          replayUrl={replay}
          storyUrl={`/api/card?${cardQ}&format=story`}
          wideUrl={`/api/card?${cardQ}&format=wide`}
          fileName={`was-playing-${month}`}
        />
      </section>

      <nav className={s.nav} aria-label="Months">
        {month > CHART_START.slice(0, 7) ? <Link href={eraHref(shiftMonth(month, -1), {})}>← {monthName(shiftMonth(month, -1))}</Link> : <span />}
        {month < through.slice(0, 7) ? <Link href={eraHref(shiftMonth(month, 1), {})}>{monthName(shiftMonth(month, 1))} →</Link> : <span />}
      </nav>

      <footer className={s.foot}>
        <span>Hot 100 #1s through {plainDate(numberOnesThrough())}; top 10s and genre charts through {plainDate(through)}. Covers from Apple. Song dates from MusicBrainz (CC0), YouTube uploads and the Hot 100. Archived pages courtesy of the Internet Archive.</span>
        <span>Was Playing is open source: <a href="https://github.com/DareDev256/music-time-machine">github.com/DareDev256/music-time-machine</a></span>
      </footer>
    </div>
  );
}
