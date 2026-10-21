// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn()); // public/era/index.json
const ytFileMock = vi.hoisted(() => vi.fn()); // public/era/index-yt.json (gitignored crawl rows; absent by default)
const routeRead = vi.hoisted(() => (p: unknown, enc?: unknown) =>
  (String(p).endsWith("index-yt.json") ? ytFileMock : readFileMock)(p, enc));
vi.mock("node:fs/promises", () => ({ readFile: routeRead, default: { readFile: routeRead } }));

type Row = { s: string; a: string; d: string; g: "day" | "month" | "year"; src: string; k: string; [extra: string]: unknown };
const row = (s: string, a: string, d: string, src = "hot100", extra: Record<string, unknown> = {}): Row => ({
  s, a, d, g: "day", src, k: `${s.toLowerCase()}|${a.toLowerCase()}`, ...extra,
});

const FIXTURE = {
  built: "2026-10-20",
  rows: [
    row("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-04-28", "seed", { ds: "uploaded to YouTube", w: ["youtube"], dsp: false }),
    row("I Don't Like", "Chief Keef ft. Lil Reese", "2012-03-12", "seed", { ds: "uploaded to YouTube" }),
    row("Hold On", "Wilson Phillips", "1990-04-14"),
    row("Hold On", "En Vogue", "1990-05-12"),
    row("Hold On", "Justin Bieber", "2021-03-20"),
    row("Hold On, Hold On", "Neko Case", "2006-03-07", "heat:hypem"),
    row("Crazy In Love", "Beyoncé featuring Jay-Z", "2003-06-07"),
    row("Gold", "Spandau Ballet", "1983-09-10", "lane:uk"),
    row("Digital Love", "Gold Panda", "2010-05-01", "heat:hypem"),
    row("Earth Song", "Earth, Wind & Fire", "1979-01-01"),
    row("Somebody That I Used To Know", "Gotye Featuring Kimbra", "2012-01-28"),
    row("No Lie (feat. Drake)", "2 Chainz", "2012-05-05"),
    row("Rolling In The Deep", "Adele", "2010-12-25", "hot100", { p: 1 }),
    row("Despacito", "Luis Fonsi & Daddy Yankee Featuring Justin Bieber", "2017-02-04", "hot100", { p: 1 }),
    row("Tennessee Whiskey", "Chris Stapleton", "2015-11-21", "hot100", { p: 20 }),
    row("Billie Jean", "Michael Jackson", "1983-01-22", "hot100", { p: 1 }),
    row("Billie Jean", "David Cook", "2008-06-07", "hot100", { p: 47 }),
    row("Hot Boy", "Bobby Shmurda", "2014-08-16", "hot100", { p: 6 }),
    row("(I Can't Get No) Satisfaction", "The Rolling Stones", "1965-06-12", "hot100", { p: 1 }),
    row("Hotline Bling", "Drake", "2015-08-15", "hot100", { p: 2 }),
    ...["Ian Matthews", "Metro Station", "Kay Flock", "Bob Seger", "Brick", "Glenn Lewis", "Ylvis", "Reba", "Jon Bon Jovi"].map((a, i) =>
      row("Shake It", a, `${1970 + i}-01-01`, "hot100", { p: i === 0 ? 1 : 50 })), // one of them a #1 too: the peak cannot decide
    row("Shake It Off", "Taylor Swift", "2014-09-06", "hot100", { p: 1 }),
    row("Star Shopping", "Lil Peep", "2017-01-15", "heat:hypem"),
    row("1999", "Prince", "1982-11-06"),
    row("Party Like It's 1999", "Someone", "1999-01-01", "heat:hotnewhiphop"),
    row("Party Anthem", "Club 1999", "2001-01-01", "heat:hypem"),
  ],
};

async function load() {
  const mod = await import("@/app/api/resolve/route");
  return mod.GET;
}
async function get(q: string | null) {
  const GET = await load();
  const url = q === null ? "http://localhost/api/resolve" : `http://localhost/api/resolve?q=${encodeURIComponent(q)}`;
  return GET(new Request(url) as never);
}
async function rows(q: string) {
  const res = await get(q);
  expect(res.status).toBe(200);
  return ((await res.json()) as { rows: Array<{ song: string; artist: string; dateSource: string; date: string }> }).rows;
}

beforeEach(() => {
  vi.resetModules();
  readFileMock.mockReset();
  readFileMock.mockResolvedValue(JSON.stringify(FIXTURE));
  ytFileMock.mockReset();
  ytFileMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
});

describe("GET /api/resolve — validation", () => {
  it("400 without q", async () => {
    expect((await get(null)).status).toBe(400);
    expect((await get("   ")).status).toBe(400);
  });

  it("400 over 200 characters", async () => {
    expect((await get("a".repeat(201))).status).toBe(400);
    expect((await get("a".repeat(200))).status).toBe(200);
  });

  it("400 on control characters", async () => {
    expect((await get("cuz\u0000my gear")).status).toBe(400);
    expect((await get("cuz\nmy gear")).status).toBe(400);
    expect((await get("cuz\u007fmy gear")).status).toBe(400);
  });
});

describe("GET /api/resolve — the index file", () => {
  it("a missing index answers 200 with no rows and x-index: missing", async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }));
    const res = await get("cuz my gear");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-index")).toBe("missing");
    expect(await res.json()).toEqual({ rows: [] });
    expect(res.headers.get("cache-control")).not.toContain("s-maxage=86400");
  });

  it("reads public/era/index.json from the project root", async () => {
    await get("cuz my gear");
    expect(String(readFileMock.mock.calls[0][0]).replace(/\\/g, "/")).toMatch(/\/public\/era\/index\.json$/);
  });

  it("adds the crawl's YouTube rows from index-yt.json when it is there", async () => {
    const va = new Date().toISOString().slice(0, 10);
    ytFileMock.mockResolvedValue(JSON.stringify({ rows: [row("Lock Arff", "Section Boyz", "2015-09-01", "yt:@LinkUpTV", { ds: "uploaded to YouTube (Link Up TV)", y: "nISWPU50HLc", va })] }));
    const found = await rows("section boyz lock arff");
    expect(found[0]).toMatchObject({ song: "Lock Arff", date: "2015-09-01", dateSource: "uploaded to YouTube (Link Up TV)" });
  });

  it("answers from index.json alone when index-yt.json is missing or broken", async () => {
    ytFileMock.mockResolvedValue("{not json");
    expect((await rows("cuz my gear"))[0]).toMatchObject({ song: "Cuz My Gear" });
  });

  it("reports what the index build cost this instance, YouTube rows counted, on every answer", async () => {
    const va = new Date().toISOString().slice(0, 10);
    ytFileMock.mockResolvedValue(JSON.stringify({ rows: [row("Lock Arff", "Section Boyz", "2015-09-01", "yt:@LinkUpTV", { va })] }));
    const GET = await load();
    for (const q of ["gold", "hold on"]) {
      const timing = (await GET(new Request(`http://localhost/api/resolve?q=${encodeURIComponent(q)}`) as never)).headers.get("server-timing");
      expect(timing).toMatch(new RegExp(`^index-build;dur=\\d+;desc="cpu ms, ${FIXTURE.rows.length + 1} rows"$`));
    }
  });

  it("is read once and cached in module scope", async () => {
    const GET = await load();
    await GET(new Request("http://localhost/api/resolve?q=hold%20on") as never);
    await GET(new Request("http://localhost/api/resolve?q=gold") as never);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it("a missing index is retried on the next request (it may be built later)", async () => {
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const GET = await load();
    const first = await GET(new Request("http://localhost/api/resolve?q=gold") as never);
    expect(first.headers.get("x-index")).toBe("missing");
    const second = await GET(new Request("http://localhost/api/resolve?q=gold") as never);
    expect(second.headers.get("x-index")).not.toBe("missing");
    expect(((await second.json()) as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
  });

  it("an unreadable index answers 200 with no rows and says so", async () => {
    readFileMock.mockResolvedValue("{not json");
    const res = await get("gold");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-index")).toBe("invalid");
    expect(await res.json()).toEqual({ rows: [] });
  });
});

describe("GET /api/resolve — matching", () => {
  it("caches at the CDN for a day", async () => {
    const res = await get("cuz my gear");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=86400");
  });

  it("returns DatedSong rows; a seed keeps its own dateSource", async () => {
    const [top] = await rows("cuz my gear");
    expect(top).toMatchObject({ song: "Cuz My Gear", date: "2012-04-28", dateSource: "uploaded to YouTube", onDsp: false });
    expect((top as unknown as { where: string[] }).where).toEqual(["seed", "youtube"]);
  });

  it('a Hot 100 row is labelled "entered the Hot 100"', async () => {
    const [top] = await rows("1999 prince");
    expect(top).toMatchObject({ song: "1999", dateSource: "entered the Hot 100" });
  });

  it("the row that explains more of the text ranks first (words are not all required)", async () => {
    const r = await rows("hold on wilson");
    expect(r[0].artist).toBe("Wilson Phillips");
  });

  it("artist words count too", async () => {
    expect((await rows("chief keef gear"))[0].song).toBe("Cuz My Gear");
  });

  it.each([
    ["rolling in the deap", "Rolling In The Deep", "Adele"],
    ["despasito luis fonsi", "Despacito", "Luis Fonsi & Daddy Yankee Featuring Justin Bieber"],
    ["i dont like chif keef", "I Don't Like", "Chief Keef ft. Lil Reese"],
    ["tenessee whiskey", "Tennessee Whiskey", "Chris Stapleton"],
  ])('tolerates typos: "%s" → %s', async (q, song, artist) => {
    expect((await rows(q))[0]).toMatchObject({ song, artist });
  });

  it("a typo that matches two songs ranks the bigger hit first (peak p)", async () => {
    const r = await rows("billy jean");
    expect(r.slice(0, 2).map((x) => x.artist)).toEqual(["Michael Jackson", "David Cook"]);
  });

  it("an artist at either end of the text returns that artist's songs, so the resolver learns the spelling", async () => {
    expect((await rows("bobby shmurda hot n word song")).map((x) => x.artist)).toContain("Bobby Shmurda");
  });

  it("a short typed word one edit off still ranks the title that accounts for every word first", async () => {
    // nine songs are called exactly "Shake It"; the one that also explains "of" must not be pushed out of the top 8
    expect((await rows("shake it of"))[0]).toMatchObject({ song: "Shake It Off", artist: "Taylor Swift" });
  });

  it("a specific title stands inside a long description", async () => {
    // most of these words are description: under half the text is the title, which must still be found
    expect((await rows("that song with the phone ringing in the video where everyone is dancing hotline bling"))[0].song).toBe("Hotline Bling");
  });

  it("run-together words map onto spaced artist names, typos allowed", async () => {
    expect((await rows("lilpeep star shopping"))[0]).toMatchObject({ song: "Star Shopping", artist: "Lil Peep" });
    expect((await rows("lilpeep")).map((x) => x.artist)).toContain("Lil Peep"); // only the glued name: nothing else to match
    expect((await rows("lilpep")).map((x) => x.artist)).toContain("Lil Peep"); // glued and misspelled
    expect((await rows("chiefkef i dont like"))[0].song).toBe("I Don't Like");
  });

  it("a title's parenthetical words count as title words", async () => {
    expect((await rows("i cant get no satisfaction"))[0].song).toBe("(I Can't Get No) Satisfaction");
  });

  it("numbers match only exactly: 1990 is not 1999", async () => {
    expect((await rows("1990")).map((x) => x.song)).not.toContain("1999");
  });

  it("strips accents, featured credits in parentheses, and treats & as and", async () => {
    expect((await rows("beyonce crazy in love"))[0].song).toBe("Crazy In Love");
    expect((await rows("earth wind and fire"))[0].song).toBe("Earth Song");
    expect((await rows("no lie 2 chainz"))[0].song).toBe("No Lie (feat. Drake)");
    expect((await rows("no lie drake"))[0].song).toBe("No Lie (feat. Drake)");
  });

  it("title words weigh more than artist words", async () => {
    expect((await rows("gold")).map((x) => x.song)).toEqual(["Gold", "Digital Love"]);
  });

  it("a year in the query boosts rows within ±1 year", async () => {
    const r = await rows("hold on 2020");
    expect(r[0].artist).toBe("Justin Bieber");
    const r90 = await rows("hold on 1991");
    expect(r90.slice(0, 2).map((x) => x.artist).sort()).toEqual(["En Vogue", "Wilson Phillips"]);
  });

  it("a year in the query does not have to appear in the row, but a title that is a year matches it", async () => {
    expect((await rows("1999")).map((x) => x.song)[0]).toBe("1999");
    expect((await rows("cuz my gear 2012"))[0].song).toBe("Cuz My Gear");
  });

  it("a bare date never returns the whole year", async () => {
    expect(await rows("2012")).toEqual([]);
    expect(await rows("March 2012")).toEqual([]);
  });

  it("a bare year matches titles that carry it, not artists named after it", async () => {
    expect((await rows("1999")).map((x) => x.song)).not.toContain("Party Anthem");
  });

  it("filler words in a sentence are ignored", async () => {
    expect((await rows("i was listening to cuz my gear by chief keef"))[0].song).toBe("Cuz My Gear");
  });

  it("an optional peak (p) breaks ties between songs that share a title", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        built: "x",
        rows: [row("Hold On", "Radiants", "1968-05-25", "hot100", { p: 68 }), row("Hold On", "Wilson Phillips", "1990-04-14", "hot100", { p: 1 })],
      }),
    );
    expect((await rows("hold on")).map((x) => x.artist)).toEqual(["Wilson Phillips", "Radiants"]);
  });

  it("without a peak, an artist with more charted songs ranks first among songs sharing a title", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        built: "x",
        rows: [
          row("Hold On", "Radiants", "1968-05-25"),
          row("Hold On", "Wilson Phillips", "1990-04-14"),
          row("Release Me", "Wilson Phillips", "1990-07-07"),
          row("You're In Love", "Wilson Phillips", "1991-02-09"),
          row("Impulsive", "Wilson Phillips", "1990-11-03"),
        ],
      }),
    );
    expect((await rows("hold on")).map((x) => x.artist)).toEqual(["Wilson Phillips", "Radiants"]);
  });

  it("returns at most 8 rows", async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({ built: "x", rows: Array.from({ length: 20 }, (_, i) => row(`Love Song ${i}`, `Artist ${i}`, "2001-01-01")) }),
    );
    expect(await rows("love song")).toHaveLength(8);
  });
});
