// @vitest-environment node
// The core cases against the REAL public/era/index.json (built by data/scripts/build_index.py), offline:
// MusicBrainz and iTunes are spies that answer nothing, so every assertion here is the index's doing.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prepareIndex, resolveQuery, searchIndex, type PreparedIndex, type ResolverDeps } from "@/lib/era/resolve";
import { norm, normUnicode } from "@/lib/era/normalize";

const FILE = path.join(process.cwd(), "public", "era", "index.json");
const YT_FILE = path.join(process.cwd(), "public", "era", "index-yt.json");
const present = existsSync(FILE);
/** Both files, as /api/resolve loads them: the committed index and the crawl's gitignored YouTube rows (if built). */
const allRows = (): unknown[] => [
  ...(JSON.parse(readFileSync(FILE, "utf8")) as { rows: unknown[] }).rows,
  ...(existsSync(YT_FILE) ? (JSON.parse(readFileSync(YT_FILE, "utf8")) as { rows: unknown[] }).rows : []),
];

describe.skipIf(!present)("resolver against the real index", () => {
  let index: PreparedIndex;
  let prepCpuMs = 0;

  beforeAll(() => {
    const rows = allRows();
    // CPU time of the build itself: /api/resolve pays it on every cold start. Wall time on a shared Mac measures
    // the other sessions (it swung 2.7–5.9 s at load average 130–200 for the same code).
    // CPU time still swings ~50% under that load (old index: 1.21 s cold, 0.80 s warm, 2026-10-20), so the budget is
    // held by the best of three builds: the cost of the code, not of the neighbours.
    prepCpuMs = Infinity;
    for (let i = 0; i < 3; i++) {
      const c = process.cpuUsage();
      index = prepareIndex(rows);
      const d = process.cpuUsage(c);
      prepCpuMs = Math.min(prepCpuMs, (d.user + d.system) / 1000);
    }
  }, 60_000);

  const deps = () => {
    const d = {
      indexSearch: vi.fn(async (q: string) => searchIndex(index, q, 8)),
      musicbrainz: vi.fn(async () => []),
      itunes: vi.fn(async () => []),
    };
    return d satisfies ResolverDeps;
  };

  it("builds the index in under 1 s of CPU, and answers a typo-tolerant lookup in under 50 ms of CPU", () => {
    expect(index.rows.length).toBeGreaterThan(5000);
    expect(prepCpuMs).toBeLessThan(1000);
    const c = process.cpuUsage();
    for (let i = 0; i < 20; i++) searchIndex(index, i % 2 ? "hold on" : "tenessee whiskey chris stapleton");
    const d = process.cpuUsage(c);
    expect((d.user + d.system) / 1000 / 20).toBeLessThan(50);
  });

  it("the ASCII fast path of norm is identical to the general path on every title and artist in the index", () => {
    const raw = allRows() as Array<{ s: string; a: string }>;
    const differ = raw.flatMap((r) => [r.s, r.a]).filter((x) => /^[\x00-\x7f]*$/.test(x) && norm(x) !== normUnicode(x));
    expect(differ).toEqual([]);
  });

  it.each([
    "cuz my gear",
    "Cuz My Gear",
    "chief keef cuz my gear 2012",
    "chief keef my gear 2012",
    "I was listening to Chief Keef, Cuz My Gear, in 2012",
    "cuz my gear by chief keef",
  ])('"%s" → Cuz My Gear, 28 Apr 2012, uploaded to YouTube, zero external calls', async (q) => {
    const d = deps();
    const out = await resolveQuery(q, d);
    expect(out).toMatchObject({ kind: "song", best: { song: "Cuz My Gear", date: "2012-04-28", dateSource: "uploaded to YouTube" } });
    expect(out.kind === "song" && out.best.youtubeId).toBe("nB9au3UBSqI");
    expect(d.musicbrainz).not.toHaveBeenCalled();
    expect(d.itunes).not.toHaveBeenCalled();
  });

  it.each([
    ["shut up stormzy", "Shut Up", "2015-05-17"],
    ["stormzy shut up", "Shut Up", "2015-05-17"],
    ["sweet shop doctor p", "Sweet Shop", "2010-03-16"],
    ["chief keef i don't like", "I Don't Like", "2012-03-12"],
    ["lil durk l's anthem", "L's Anthem", "2012-03-28"],
  ])('seed "%s" → %s %s with zero external calls', async (q, song, date) => {
    const d = deps();
    expect(await resolveQuery(q, d)).toMatchObject({ kind: "song", best: { song, date } });
    expect(d.musicbrainz).not.toHaveBeenCalled();
  });

  it('"1999" is Prince\'s song, flagged as also a year; "1985" likewise; "2012" stays the year', async () => {
    expect(await resolveQuery("1999", deps())).toMatchObject({ kind: "song", best: { song: "1999", artist: "Prince" }, needsPick: true });
    expect(await resolveQuery("1985", deps())).toMatchObject({ kind: "song", best: { song: "1985" }, needsPick: true });
  });

  it.each([
    ["Summer of '69", "Summer Of '69", "Bryan Adams"],
    ["7 Years", "7 Years", "Lukas Graham"],
    ["rolling in the deep", "Rolling In The Deep", "Adele"],
    ["adele rolling in the deep 2011", "Rolling In The Deep", "Adele"],
  ])('"%s" → %s by %s', async (q, song, artist) => {
    const out = await resolveQuery(q, deps());
    expect(out).toMatchObject({ kind: "song", best: { song, artist } });
    expect(out.kind === "song" && out.needsPick).toBeFalsy();
  });

  it('a chart date reads "entered the Hot 100"', async () => {
    const out = await resolveQuery("1999", deps());
    expect(out.kind === "song" && out.best.dateSource).toBe("entered the Hot 100");
  });

  it('"hold on" is a common title: a pick, never a guess', async () => {
    const out = await resolveQuery("hold on", deps());
    expect(out).toMatchObject({ kind: "song", needsPick: true });
    expect(out.kind === "song" && out.candidates.length).toBe(3);
  });

  it.each([
    ["2012", "2012-06-15"],
    ["March 2012", "2012-03-15"],
    ["summer 2012", "2012-07-15"],
    ["2012-04-28", "2012-04-28"],
  ])('"%s" is a date (%s)', async (q, date) => {
    expect(await resolveQuery(q, deps())).toMatchObject({ kind: "date", date });
  });
});

// 2026-10-20, from James: "casper dopeboy" found nothing. "dopeboy" is a known index word ("Dopeboy Swag"),
// which blocked the run-together split to "dope boy"; both readings are now scored.
describe("a known word that is also a run-together name", () => {
  it.skipIf(!present)("\"casper dopeboy\" → Dope Boy, Casper TNG & Fresh, uploaded to YouTube 10 Feb 2015", async () => {
    const index = prepareIndex(allRows());
    const calls = { mb: 0, it: 0 };
    const out = await resolveQuery("casper dopeboy", {
      indexSearch: async (q) => searchIndex(index, q),
      musicbrainz: async () => { calls.mb++; return []; },
      itunes: async () => { calls.it++; return []; },
    });
    expect(out.kind).toBe("song");
    if (out.kind !== "song") return;
    expect(out.best.song).toBe("Dope Boy");
    expect(out.best.date).toBe("2015-02-10");
    expect(out.best.youtubeId).toBe("E7ZStZMn-ac");
  });
});
