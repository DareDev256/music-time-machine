// The core cases against the REAL public/era/index.json (built by data/scripts/build_index.py), offline:
// MusicBrainz and iTunes are spies that answer nothing, so every assertion here is the index's doing.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prepareIndex, resolveQuery, searchIndex, type PreparedIndex, type ResolverDeps } from "@/lib/era/resolve";

const FILE = path.join(process.cwd(), "public", "era", "index.json");
const present = existsSync(FILE);

describe.skipIf(!present)("resolver against the real index", () => {
  let index: PreparedIndex;
  let prepMs = 0;

  beforeAll(() => {
    const t = performance.now();
    index = prepareIndex((JSON.parse(readFileSync(FILE, "utf8")) as { rows: unknown[] }).rows);
    prepMs = performance.now() - t;
  });

  const deps = () => {
    const d = {
      indexSearch: vi.fn(async (q: string) => searchIndex(index, q, 8)),
      musicbrainz: vi.fn(async () => []),
      itunes: vi.fn(async () => []),
    };
    return d satisfies ResolverDeps;
  };

  it("loads and indexes once in well under 2 s, and answers a lookup in under 50 ms", () => {
    expect(index.rows.length).toBeGreaterThan(5000);
    expect(prepMs).toBeLessThan(2000);
    const t = performance.now();
    for (let i = 0; i < 20; i++) searchIndex(index, "hold on");
    expect((performance.now() - t) / 20).toBeLessThan(50);
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
