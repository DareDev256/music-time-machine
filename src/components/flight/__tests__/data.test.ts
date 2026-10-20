import { describe, expect, it } from "vitest";
import { artUrl, firstGateAtOrAfter, isFlightDoc, passingAt, prepare, runsBetween, targetIndex, type FlightDoc } from "../data";

const doc: FlightDoc = {
  through: "2013-01-12",
  songs: [
    { s: "Somebody That I Used to Know", a: "Gotye featuring Kimbra", art: "https://x/{w}x{h}bb.jpg" },
    { s: "Call Me Maybe", a: "Carly Rae Jepsen", art: null },
    { s: "Locked Out of Heaven", a: "Bruno Mars", art: null },
  ],
  weeks: [
    ["2012-04-21", 0],
    ["2012-04-28", 0],
    ["2012-05-05", 0],
    ["2012-06-23", 1],
    ["2012-12-29", 2],
    ["2013-01-05", 2],
    ["2013-01-12", 2],
  ],
};

describe("prepare", () => {
  const d = prepare(doc);
  it("reverses into newest-first path order", () => {
    expect(d.dates[0]).toBe("2013-01-12");
    expect(d.dates[d.dates.length - 1]).toBe("2012-04-21");
  });
  it("counts #1 runs chronologically", () => {
    // 2012-04-28 is Gotye's 2nd of 3 weeks
    const i = d.dates.indexOf("2012-04-28");
    expect(passingAt(d, i)).toEqual({
      date: "2012-04-28",
      song: "Somebody That I Used to Know",
      artist: "Gotye featuring Kimbra",
      runWeek: 2,
      runLength: 3,
    });
    expect(passingAt(d, 0).runWeek).toBe(3); // newest week of Bruno's run
  });
  it("groups weeks into #1 runs, one node each", () => {
    // newest first: Bruno ×3, Carly ×1, Gotye ×3
    expect(Array.from(d.runStart)).toEqual([0, 3, 4]);
    expect(Array.from(d.runEnd)).toEqual([2, 3, 6]);
    expect(d.runOf[d.dates.indexOf("2012-04-28")]).toBe(2);
    expect(runsBetween(d, 1, 5)).toEqual([0, 2]);
    expect(runsBetween(d, -4, 99)).toEqual([0, 2]);
  });
  it("puts a gate at the year change", () => {
    expect(Array.from(d.gates)).toEqual([d.dates.indexOf("2012-12-29")]);
    expect(firstGateAtOrAfter(d, 0)).toBe(0);
    expect(firstGateAtOrAfter(d, 6)).toBe(1);
  });
});

describe("targetIndex", () => {
  const d = prepare(doc);
  it("lands on the chart week in force on the date", () => {
    expect(d.dates[targetIndex(d, "2012-04-28")]).toBe("2012-04-28");
    expect(d.dates[targetIndex(d, "2012-05-01")]).toBe("2012-04-28");
    expect(d.dates[targetIndex(d, "2012-11-01")]).toBe("2012-06-23");
  });
  it("clamps before the first and after the last week", () => {
    expect(d.dates[targetIndex(d, "1950-01-01")]).toBe("2012-04-21");
    expect(targetIndex(d, "2030-01-01")).toBe(0);
  });
});

describe("isFlightDoc", () => {
  it("refuses a doc whose week points at a missing song", () => {
    expect(isFlightDoc({ ...doc, weeks: [["2012-01-01", 9]] })).toBe(false);
    expect(isFlightDoc({ ...doc, weeks: [] })).toBe(false);
    expect(isFlightDoc(doc)).toBe(true);
  });
});

it("artUrl fills the iTunes size template", () => {
  expect(artUrl("https://x/{w}x{h}bb.jpg", 200)).toBe("https://x/200x200bb.jpg");
});
