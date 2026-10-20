import { describe, it, expect } from "vitest";
import { verdictFor, earliestOf, periodMonths, monthIndex, verdictNote, type KnownDate } from "../verdict";

const k = (date: string, source = "musicbrainz"): KnownDate => ({ source, date, label: "x" });

describe("verdictFor", () => {
  it("unverified when nothing dated was found", () => {
    expect(verdictFor("2012-05", [])).toEqual({ known: [], verdict: "unverified" });
    // malformed dates are dropped, not trusted
    expect(verdictFor("2012-05", [k("2012-13-01"), k("soon")]).verdict).toBe("unverified");
  });

  it("consistent: earliest known date on or before the claim and within 24 months", () => {
    // Cuz My Gear: YouTube upload 2012-04-28, claimed May 2012
    const e = verdictFor("2012-05", [k("2012-05-17"), k("2012-04-28", "index")]);
    expect(e.verdict).toBe("consistent");
    expect(e.earliest).toBe("2012-04-28");
    expect(verdictFor("2012-05", [k("2012-05-31")]).verdict).toBe("consistent"); // same month
    expect(verdictFor("2014-05", [k("2012-05-01")]).verdict).toBe("consistent"); // exactly 24 months
  });

  it("blew-up-later: released more than 24 months before the claimed month", () => {
    // Crank That: 2007, claimed June 2013
    const e = verdictFor("2013-06", [k("2007-09-29", "index"), k("2007-11-28")]);
    expect(e.verdict).toBe("blew-up-later");
    expect(e.earliest).toBe("2007-09-29");
    expect(verdictFor("2014-06", [k("2012-05-17")]).verdict).toBe("blew-up-later"); // 25 months
  });

  it("before-release: claim more than 2 months before every known date", () => {
    // Not Like Us: 2024-05-04, claimed January 2019
    expect(verdictFor("2019-01", [k("2024-05-18", "index"), k("2024-05-04", "itunes")]).verdict).toBe("before-release");
    expect(verdictFor("2012-01", [k("2012-04-28")]).verdict).toBe("before-release"); // 3 months early
  });

  it("a claim up to 2 months before the first date still counts as consistent (leaks, early plays)", () => {
    expect(verdictFor("2012-02", [k("2012-04-28")]).verdict).toBe("consistent");
    expect(verdictFor("2012-03", [k("2012-04-28")]).verdict).toBe("consistent");
  });

  it("a year-only date spans its whole year", () => {
    // "2012" could be December 2012, so a February 2012 claim is not before release …
    expect(verdictFor("2012-02", [k("2012")]).verdict).toBe("consistent");
    // … and could be January 2012, so a December 2014 claim is still within 24 months of its end
    expect(verdictFor("2014-12", [k("2012")]).verdict).toBe("consistent");
    expect(verdictFor("2015-01", [k("2012")]).verdict).toBe("blew-up-later");
    expect(verdictFor("2011-09", [k("2012")]).verdict).toBe("before-release");
  });
});

describe("earliestOf", () => {
  it("prefers a precise date over a bare year that contains it, but not over an earlier year", () => {
    expect(earliestOf([k("2024"), k("2024-05-04")])?.date).toBe("2024-05-04");
    expect(earliestOf([k("2023"), k("2024-05-04")])?.date).toBe("2023");
    expect(earliestOf([])).toBeNull();
  });
});

describe("helpers", () => {
  it("periodMonths and monthIndex", () => {
    expect(periodMonths("2012")).toEqual([monthIndex("2012-01"), monthIndex("2012-12")]);
    expect(periodMonths("2012-05-17")).toEqual([monthIndex("2012-05"), monthIndex("2012-05")]);
    expect(() => monthIndex("2012-5")).toThrow();
  });

  it("verdictNote reads as a fact", () => {
    expect(verdictNote("blew-up-later", "2010-03-01")).toBe("released 2010, blew up later");
    expect(verdictNote("consistent", "2012-04-28")).toBe("released Apr 2012");
    expect(verdictNote("unverified")).toBe("no release date on file");
  });
});
