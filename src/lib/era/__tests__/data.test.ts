// @vitest-environment node
import { describe, it, expect } from "vitest";
import { weekNearest, lanesOn, heatFor, numberOneOn, indexRow, indexKey, chartsThrough, weeksInMonth, redditFor, heatMonthSpan } from "../data";

// These run against the real shards in public/era/: they prove the pipelines' output, not a fixture.

describe("weekNearest", () => {
  it("returns the chart week in effect, never one after the date", () => {
    const w = weekNearest("2012-04-28")!;
    expect(w.date <= "2012-04-28").toBe(true);
    expect((Date.parse("2012-04-28") - Date.parse(w.date)) / 86_400_000).toBeLessThan(7);
    expect(w.top).toHaveLength(10);
    expect(w.top[0].song).toBe("Somebody That I Used To Know");
  });
  it("crosses a year boundary (the first days of January use December's chart)", () => {
    const w = weekNearest("2013-01-01")!;
    expect(w.date.startsWith("2012-12")).toBe(true);
  });
  it("has nothing before the first Hot 100", () => {
    expect(weekNearest("1958-07-01")).toBeNull();
  });
});

describe("numberOneOn", () => {
  it("carries the run position", () => {
    const n = numberOneOn("2012-04-28")!;
    // The flight list is Wikipedia's spelling ("Used to Know"); the weekly chart is Billboard's.
    expect(n.song.toLowerCase()).toBe("somebody that i used to know");
    expect(n.runLength).toBeGreaterThanOrEqual(8);
    expect(n.runWeek).toBeGreaterThanOrEqual(1);
    expect(n.runWeek).toBeLessThanOrEqual(n.runLength);
  });
});

describe("lanesOn", () => {
  it("returns only lanes that existed on the date", () => {
    const lanes = lanesOn("1980-06-14").map((l) => l.lane);
    expect(lanes).not.toContain("rap");      // Hot Rap Songs starts 1989
    expect(lanes).not.toContain("canada");   // Canadian Hot 100 starts 2007
    expect(lanes).toContain("country");
  });
  it("gives every lane a dated #1 within a week of the date in 2012", () => {
    const lanes = lanesOn("2012-04-28");
    expect(lanes.length).toBeGreaterThanOrEqual(6);
    for (const l of lanes) {
      expect(l.song.length).toBeGreaterThan(0);
      expect((Date.parse("2012-04-28") - Date.parse(l.date)) / 86_400_000).toBeLessThanOrEqual(8);
    }
  });
});

describe("heatFor", () => {
  it("is null outside the crawl", () => {
    expect(heatFor("1999-01")).toBeNull(); // before the first archived blog month
    expect(heatFor("not-a-month")).toBeNull();
  });
  it("returns archived, linked lists inside it", () => {
    const h = heatFor("2012-05")!;
    expect(h.sources.length).toBeGreaterThanOrEqual(2);
    for (const s of h.sources) {
      expect(s.capture).toMatch(/^https:\/\/web\.archive\.org\/web\/\d{14}\//);
      expect(s.rows.length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("index", () => {
  it("finds the core case from the seed", () => {
    const r = indexRow("Cuz My Gear", "Chief Keef")!;
    expect(r.d).toBe("2012-04-28");
    expect(r.src).toBe("seed");
    expect(r.y).toBe("nB9au3UBSqI");
  });
  it("keys ignore accents, articles and featured artists", () => {
    expect(indexKey("Señorita", "Shawn Mendes & Camila Cabello")).toBe(indexKey("Senorita", "Shawn Mendes"));
    expect(indexKey("The Motto", "Drake Featuring Lil Wayne")).toBe(indexKey("Motto", "Drake"));
  });
});

describe("chartsThrough / weeksInMonth", () => {
  it("knows the newest chart week", () => {
    expect(chartsThrough() >= "2026-10-01").toBe(true);
  });
  it("lists a month's issue weeks", () => {
    expect(weeksInMonth("2012-04")).toEqual(["2012-04-07", "2012-04-14", "2012-04-21", "2012-04-28"]);
  });
});

describe("redditFor / heatMonthSpan", () => {
  it("is null for a month with no file and for junk", () => {
    expect(redditFor("1975-01")).toBeNull();
    expect(redditFor("nope")).toBeNull();
  });
  it("returns ranked [FRESH] rows with a thread link for a crawled month", () => {
    const r = redditFor("2012-05");
    if (!r) return; // the Reddit crawl may not have reached this month on a fresh checkout
    for (const src of r) {
      expect(src.rows.length).toBeGreaterThanOrEqual(5);
      expect(src.rows[0].url).toMatch(/^https:\/\/www\.reddit\.com\/r\//);
      for (let i = 1; i < src.rows.length; i++) expect(src.rows[i].score).toBeLessThanOrEqual(src.rows[i - 1].score);
    }
  });
  it("reads the off-chart span from the files, not from a summary", () => {
    const span = heatMonthSpan()!;
    expect(span[0] <= "2010-01").toBe(true);
    expect(span[1] >= "2014-12").toBe(true);
  });
});
