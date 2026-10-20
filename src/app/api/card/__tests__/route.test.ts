// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { cleanText, parseCardParams, FIRST_CHART_WEEK, MAX_TEXT } from "../params";
import { coverData, clearCoverMemo } from "../covers";
import { buildCard, offChart } from "../model";
import { fit, wrap } from "../text";
import { heatFor } from "@/lib/era/data";

const ctx = { params: Promise.resolve({}) };
let ip = 1;
// A fresh client address per request keeps the per-IP og bucket out of the way.
const call = (qs: string) =>
  GET(new NextRequest(`http://localhost/api/card${qs}`, { headers: { "x-forwarded-for": `10.9.0.${ip++}` } }), ctx);

async function png(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { buf, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Set CARD_SHOTS=<dir> to keep the rendered PNGs for a visual check.
function keep(name: string, buf: Buffer) {
  const dir = process.env.CARD_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), buf);
}

const GEAR = "?song=Cuz%20My%20Gear&artist=Chief%20Keef%20%26%20Riff%20Raff&date=2012-04-28";

describe("parseCardParams", () => {
  const p = (qs: string, today = "2026-10-20") => parseCardParams(new URLSearchParams(qs), { today });

  it("no params at all is the branded default card, wide", () => {
    expect(p("")).toEqual({ kind: "default", format: "wide" });
    expect(p("format=story")).toEqual({ kind: "default", format: "story" });
  });
  it("refuses dates that are not real calendar days", () => {
    for (const d of ["2012-13-01", "2012-02-30", "2012-4-28", "yesterday", "", "2012-04-28T00:00"]) {
      expect(p(`date=${d}`)).toMatchObject({ kind: "error", status: 400 });
    }
  });
  it("refuses future dates and unknown formats", () => {
    expect(p("date=2026-10-21")).toMatchObject({ kind: "error", status: 400 });
    expect(p("date=2012-04-28&format=square")).toMatchObject({ kind: "error", status: 400 });
  });
  it("moves a date before the Hot 100 to its first week", () => {
    expect(p("date=1950-06-01&song=Mona%20Lisa&artist=Nat%20King%20Cole")).toMatchObject({ kind: "card", date: FIRST_CHART_WEEK, clamped: true });
    expect(p("date=1958-08-04")).toMatchObject({ date: FIRST_CHART_WEEK, clamped: false });
  });
  it("takes the date from the index when only a song is given", () => {
    const r = parseCardParams(new URLSearchParams("song=Cuz%20My%20Gear&artist=Chief%20Keef"), { today: "2026-10-20", lookupDate: () => "2012-04-28" });
    expect(r).toMatchObject({ kind: "card", date: "2012-04-28" });
    expect(parseCardParams(new URLSearchParams("song=Nothing"), { lookupDate: () => null })).toMatchObject({ kind: "error" });
  });
  it("strips control, bidi and emoji characters and caps length", () => {
    expect(cleanText("Cuz\u0000 My\u202E Gear\u200B \u{1F525}")).toBe("Cuz My Gear");
    expect(cleanText("\u0007\u0008  ")).toBeNull();
    expect(Array.from(cleanText("x".repeat(500))!).length).toBe(MAX_TEXT);
    // A cap never splits a surrogate pair.
    expect(cleanText("\u{1D11E}".repeat(200))).toBe("\u{1D11E}".repeat(MAX_TEXT));
  });
});

describe("text fitting", () => {
  it("shrinks a long title until it fits its lines and height", () => {
    const title = "SOMEBODY THAT I USED TO KNOW (FEAT. KIMBRA)";
    const f = fit(title, { face: "display", width: 856, maxHeight: 330, maxLines: 6, max: 168, min: 56, lineHeight: 0.9 });
    expect(f.lines * f.size * 0.9).toBeLessThanOrEqual(330);
    expect(wrap(title, "display", f.size, 856).length).toBe(f.lines);
    expect(f.size).toBeLessThan(168);
  });
  it("keeps a short title at the largest size", () => {
    expect(fit("US", { face: "display", width: 856, maxHeight: 330, maxLines: 3, max: 168, min: 56, lineHeight: 0.9 }).size).toBe(168);
  });
});

describe("off-chart rows", () => {
  it("leads with the anchor artist's own archived rows, labelled by source", () => {
    const rows = offChart(heatFor("2012-04"), "Chief Keef & Riff Raff", { song: "Somebody That I Used to Know" }, 3);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    for (const r of rows) expect(r.source).toMatch(/^(HOTNEWHIPHOP|HYPE MACHINE|BILLBOARD)/);
  });
  it("is empty for a month the crawl never covered", () => {
    expect(offChart(heatFor("1999-07"), "TLC", null, 3)).toEqual([]);
    expect(buildCard({ song: null, artist: null, date: "1999-07-10", clamped: false }, 3).heat).toEqual([]);
  });
});

describe("coverData", () => {
  const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  beforeEach(() => clearCoverMemo());
  afterEach(() => vi.unstubAllGlobals());

  it("refuses any host but the iTunes art CDN without fetching", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await coverData("https://evil.example/a.jpg")).toBeNull();
    expect(await coverData("http://is1-ssl.mzstatic.com/a.jpg")).toBeNull();
    expect(await coverData("https://is1-ssl.mzstatic.com.evil.example/a.jpg")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("returns a data URI for real image bytes and null for anything else", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PIXEL, { headers: { "content-type": "image/png" } })));
    expect(await coverData("https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg")).toMatch(/^data:image\/png;base64,/);
    clearCoverMemo();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { headers: { "content-type": "image/jpeg" } })));
    expect(await coverData("https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await coverData("https://is2-ssl.mzstatic.com/image/thumb/y/600x600bb.jpg")).toBeNull();
  });
});

describe("GET /api/card", () => {
  // Covers come from the network in production; the route must still draw a card without them.
  beforeEach(() => {
    clearCoverMemo();
    if (!process.env.CARD_SHOTS || process.env.CARD_OFFLINE) vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline in tests"); }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("400s with JSON on a bad date", async () => {
    const res = await call("?date=2012-02-30&song=Cuz%20My%20Gear");
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toHaveProperty("error");
  });

  it("renders a 1080×1920 story PNG", async () => {
    const res = await call(`${GEAR}&format=story`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400, s-maxage=604800, immutable");
    const { buf, width, height } = await png(res);
    expect([width, height]).toEqual([1080, 1920]);
    keep("card-story.png", buf);
  }, 60_000);

  it("renders a 1200×630 wide PNG", async () => {
    const res = await call(`${GEAR}&format=wide`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const { buf, width, height } = await png(res);
    expect([width, height]).toEqual([1200, 630]);
    keep("card-wide.png", buf);
  }, 60_000);

  it("renders the branded default card with no params", async () => {
    const res = await call("");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const { buf, width, height } = await png(res);
    expect([width, height]).toEqual([1200, 630]);
    keep("card-default.png", buf);
  }, 60_000);

  it.each([
    ["edge-maxlen-story", `?song=${encodeURIComponent("Wake Me Up Before You Go-Go Remastered Extended Twelve Inch Version Featuring Absolutely Everyone Who Was There In 1984")}&artist=${encodeURIComponent("The Extraordinarily Long Named Orchestra and Chorus of the Royal Philharmonic Society Featuring Special Guests Galore")}&date=1985-01-05&format=story`, 1080, 1920],
    ["edge-maxlen-wide", `?song=${encodeURIComponent("Wake Me Up Before You Go-Go Remastered Extended Twelve Inch Version Featuring Absolutely Everyone Who Was There In 1984")}&artist=${encodeURIComponent("The Extraordinarily Long Named Orchestra and Chorus of the Royal Philharmonic Society Featuring Special Guests Galore")}&date=1985-01-05&format=wide`, 1200, 630],
    ["edge-dateonly-story", "?date=1999-07-10&format=story", 1080, 1920],
    ["edge-dateonly-wide", "?date=1999-07-10&format=wide", 1200, 630],
    ["edge-1950-story", "?song=Mona%20Lisa&artist=Nat%20King%20Cole&date=1950-06-01&format=story", 1080, 1920],
    ["edge-pastdata-wide", "?song=New%20Song&artist=Someone&date=2026-10-15&format=wide", 1200, 630],
    ["edge-default-story", "?format=story", 1080, 1920],
  ])("renders the %s edge case", async (name, qs, w, h) => {
    const res = await call(qs);
    expect(res.status).toBe(200);
    const { buf, width, height } = await png(res);
    expect([width, height]).toEqual([w, h]);
    keep(`${name}.png`, buf);
  }, 60_000);

  it("fits a 40-character title on the story card", async () => {
    const res = await call("?song=Somebody%20That%20I%20Used%20To%20Know%20(feat.%20Kimbra)&artist=Gotye&date=2012-04-28&format=story");
    expect(res.status).toBe(200);
    const { buf, width, height } = await png(res);
    expect([width, height]).toEqual([1080, 1920]);
    keep("card-long.png", buf);
  }, 60_000);
});
