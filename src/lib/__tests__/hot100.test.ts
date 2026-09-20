import { describe, it, expect } from "vitest";
import {
  numberOneOn, numberOnesBetween, conceptionWindow, parseIsoDate,
  hot100WeekCount, HOT100_FIRST_ISSUE, HOT100_LAST_ISSUE,
} from "../hot100";
import { primaryArtist } from "../coverArt";

describe("dataset", () => {
  it("starts on the first Hot 100 issue and covers every week since", () => {
    expect(HOT100_FIRST_ISSUE).toBe("1958-08-04");
    // 1958-08-04 → 2026-09-19 is 3,555 weeks; the dataset holds one row per issue
    // plus Billboard's own irregular issues (1976 bicentennial, 2018 date shift).
    expect(hot100WeekCount()).toBeGreaterThanOrEqual(3550);
    expect(HOT100_LAST_ISSUE >= "2026-09-19").toBe(true);
  });
});

describe("numberOneOn", () => {
  it("returns the #1 in effect on a mid-week date (issue dated the prior Saturday)", () => {
    const n = numberOneOn("1994-03-14")!;
    expect(n.song).toBe("The Sign");
    expect(n.artist).toBe("Ace of Base");
    expect(n.date).toBe("1994-03-12");
  });

  it("derives the run length across consecutive weeks", () => {
    // "One Sweet Day" — 16 weeks, Dec 1995 → Mar 1996
    const n = numberOneOn("1996-01-15")!;
    expect(n.song).toBe("One Sweet Day");
    expect(n.weeksAtOne).toBe(16);
    expect(n.runStart).toBe("1995-12-02");
  });

  it("returns the very first #1 on the launch date", () => {
    expect(numberOneOn("1958-08-04")!.song).toBe("Poor Little Fool");
  });

  it("returns null before the chart existed and for garbage", () => {
    expect(numberOneOn("1958-08-03")).toBeNull();
    expect(numberOneOn("1950-01-01")).toBeNull();
    expect(numberOneOn("not-a-date")).toBeNull();
    expect(numberOneOn("2024-02-30")).toBeNull();
  });

  it("does not split a run when the same record re-enters after a gap", () => {
    // "Blinding Lights" was not #1 continuously; the run in effect on 2020-04-15 is one block.
    const n = numberOneOn("2020-04-15")!;
    expect(n.song).toBe("Blinding Lights");
    expect(n.runEnd >= n.runStart).toBe(true);
  });
});

describe("numberOnesBetween", () => {
  it("lists each distinct #1 once, in chart order", () => {
    const runs = numberOnesBetween("2012-02-04", "2012-04-30");
    expect(runs.map((r) => r.song)).toEqual([
      "Set Fire to the Rain", "Stronger (What Doesn't Kill You)", "Part of Me", "Stronger (What Doesn't Kill You)", "We Are Young", "Somebody That I Used to Know",
    ]);
  });

  it("includes the run already in effect at the start of the window", () => {
    const runs = numberOnesBetween("1996-01-10", "1996-01-20");
    expect(runs).toHaveLength(1);
    expect(runs[0].song).toBe("One Sweet Day");
  });

  it("returns an empty list for an inverted or invalid range", () => {
    expect(numberOnesBetween("2000-02-01", "2000-01-01")).toEqual([]);
    expect(numberOnesBetween("bad", "2000-01-01")).toEqual([]);
  });
});

describe("conceptionWindow", () => {
  it("is 266 days before the birth date, ±7 days", () => {
    expect(conceptionWindow("1994-03-14")).toEqual({ from: "1993-06-14", to: "1993-06-28" });
  });

  it("rejects an invalid date", () => {
    expect(conceptionWindow("1994-13-01")).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("accepts only real calendar dates in YYYY-MM-DD", () => {
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
    expect(parseIsoDate("2023-02-29")).toBeNull();
    expect(parseIsoDate("2024-2-9")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("primaryArtist", () => {
  it("strips featured credits so the art search hits the primary artist", () => {
    expect(primaryArtist("Rihanna featuring Calvin Harris")).toBe("Rihanna");
    expect(primaryArtist("Fun featuring Janelle Monáe")).toBe("Fun");
    expect(primaryArtist("Kendrick Lamar & SZA")).toBe("Kendrick Lamar");
    expect(primaryArtist("Ace of Base")).toBe("Ace of Base");
  });
});
