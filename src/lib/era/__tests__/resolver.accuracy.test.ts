// @vitest-environment node
// Resolver accuracy against an INDEPENDENT ground-truth set (built by someone who never saw this code).
// Live network: skipped unless RESOLVER_TRUTH points at the truth JSON.
//   RESOLVER_TRUTH=/path/resolver-truth.json RESOLVER_OUT=/path/out.json npx vitest run src/lib/era/__tests__/resolver.accuracy.test.ts
// RESOLVER_YT_KEY_FILE=/path/to/key adds the YouTube last lookup (100 quota units per search it makes; the count is printed).
// Bar (spec §8): at least 85% of answers land inside the truth's accept_year_window, with the right song.

import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveQuery, prepareIndex, searchIndex, buildMbQuery, mapMusicBrainz, mapItunes, type ResolverDeps } from "../resolve";
import { cleanQuery } from "../normalize";
import { mapYouTubeSearch } from "../youtube";

const TRUTH = process.env.RESOLVER_TRUTH;
const UA = "MusicTimeMachine/2.0 (dev@jamesdare.com; accuracy test)";

interface Truth { q: string; song: string; artist: string; first_public: string; where: string; accept_year_window: [number, number]; tricky?: string }

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[([][^)\]]*[)\]]/g, "").replace(/[^a-z0-9]/g, "");
const sameTitle = (a: string, b: string) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

let lastMb = 0;
// Reporting only: how often each service refused (a throttled iTunes looks like "no match" to the resolver).
const refused: Record<string, Record<string, number>> = { musicbrainz: {}, itunes: {} };
const tally = (url: string, code: string) => {
  const host = url.includes("musicbrainz.org") ? "musicbrainz" : "itunes";
  refused[host][code] = (refused[host][code] ?? 0) + 1;
};
async function getJson(url: string): Promise<unknown> {
  if (url.includes("musicbrainz.org")) { // MusicBrainz asks for 1 request per second
    const wait = 1100 - (Date.now() - lastMb);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastMb = Date.now();
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) tally(url, String(res.status));
    return res.ok ? await res.json() : null;
  } catch { tally(url, "network"); return null; }
}

function nodeDeps(): ResolverDeps {
  const read = (f: string) => { try { return (JSON.parse(readFileSync(path.join(process.cwd(), f), "utf8")) as { rows: unknown[] }).rows; } catch { return []; } };
  const index = prepareIndex([...read("public/era/index.json"), ...read("public/era/index-yt.json")]);
  return {
    async indexSearch(q) { return searchIndex(index, q); },
    async musicbrainz(q) { return mapMusicBrainz(await getJson(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(buildMbQuery(q))}&fmt=json&limit=8`)); },
    async itunes(q) { return mapItunes(await getJson(`https://itunes.apple.com/search?media=music&entity=song&limit=8&term=${encodeURIComponent(cleanQuery(q))}`)); },
    ...(YT_KEY ? {
      async youtube(q: string) {
        ytSearches++;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(cleanQuery(q))}&key=${encodeURIComponent(YT_KEY)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        return res?.ok ? mapYouTubeSearch(await res.json()) : [];
      },
    } : {}),
  };
}
const YT_KEY = process.env.RESOLVER_YT_KEY_FILE ? readFileSync(process.env.RESOLVER_YT_KEY_FILE, "utf8").trim() : "";
let ytSearches = 0;

describe.skipIf(!TRUTH)("resolver accuracy (live)", () => {
  it("lands at least 85% of independent truth rows in their accepted year window", async () => {
    const truth = JSON.parse(readFileSync(TRUTH!, "utf8")) as Truth[];
    const deps = nodeDeps();
    const rows = [];
    for (const t of truth) {
      const before = JSON.stringify(refused);
      const out = await resolveQuery(t.q, deps);
      const refusedHere = before === JSON.stringify(refused) ? undefined : JSON.stringify(refused);
      const year = out.kind === "song" ? Number(out.best.date.slice(0, 4)) : out.kind === "date" ? Number(out.date.slice(0, 4)) : null;
      const song = out.kind === "song" ? out.best : null;
      const songOk = song ? sameTitle(song.song, t.song) : false;
      const yearOk = year !== null && year >= t.accept_year_window[0] && year <= t.accept_year_window[1];
      // A picker that holds the right song among its candidates counts: the visitor taps it.
      const inPicker = out.kind === "song" && !!out.needsPick && out.candidates.some((c) => sameTitle(c.song, t.song));
      rows.push({
        q: t.q, expect: `${t.song} / ${t.artist} / ${t.first_public}`, where: t.where,
        got: song ? `${song.song} / ${song.artist} / ${song.date} (${song.dateSource})` : out.kind === "date" ? `date ${out.date}` : `none: ${out.kind === "none" ? out.reason : ""}`,
        pass: (songOk && yearOk) || inPicker, songOk, yearOk, inPicker,
        // Reporting only: a refusal during this query (cumulative counts after it), so a throttled miss is visible.
        ...(refusedHere ? { refusedDuring: refusedHere } : {}),
      });
    }
    const passed = rows.filter((r) => r.pass).length;
    const nonDsp = rows.filter((r) => r.where !== "dsp");
    const summary = { passed, total: rows.length, rate: passed / rows.length, nonDspPassed: nonDsp.filter((r) => r.pass).length, nonDspTotal: nonDsp.length, refused, ytSearches };
    if (process.env.RESOLVER_OUT) writeFileSync(process.env.RESOLVER_OUT, JSON.stringify({ summary, rows }, null, 1));
    console.log(JSON.stringify(summary));
    for (const r of rows.filter((x) => !x.pass)) console.log(`MISS  ${r.q}  →  ${r.got}   (want ${r.expect})${r.refusedDuring ? `   [refused during: ${r.refusedDuring}]` : ""}`);
    expect(summary.rate).toBeGreaterThanOrEqual(0.85);
  }, 600_000);
});
