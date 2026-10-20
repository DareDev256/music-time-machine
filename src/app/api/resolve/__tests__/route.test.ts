// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const readFileMock = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({ readFile: readFileMock, default: { readFile: readFileMock } }));

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

  it("every query token must appear in the title or artist", async () => {
    const r = await rows("hold on wilson");
    expect(r.map((x) => x.artist)).toEqual(["Wilson Phillips"]);
  });

  it("artist words count too", async () => {
    expect((await rows("chief keef gear")).map((x) => x.song)).toEqual(["Cuz My Gear"]);
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
