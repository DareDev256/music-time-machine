import { describe, it, expect, vi, afterEach } from "vitest";
import { CHART_START, extractDate, extractDateDetail, flightTarget } from "@/lib/era/dates";

describe("extractDate — the plan's exact cases", () => {
  it("a trailing bare year becomes year granularity, mid-year, and leaves the rest", () => {
    expect(extractDate("chief keef cuz my gear 2012")).toEqual({
      date: "2012-06-15",
      granularity: "year",
      rest: "chief keef cuz my gear",
    });
  });

  it('"March 2012" is a month, mid-month', () => {
    expect(extractDate("March 2012")).toEqual({ date: "2012-03-15", granularity: "month", rest: "" });
  });

  it('"2012-04-28" is a day', () => {
    expect(extractDate("2012-04-28")).toEqual({ date: "2012-04-28", granularity: "day", rest: "" });
  });

  it(`"'12" is the year 2012`, () => {
    expect(extractDate("'12")).toEqual({ date: "2012-06-15", granularity: "year", rest: "" });
  });

  it('"summer 2012" is a month at 2012-07-15', () => {
    expect(extractDate("summer 2012")).toEqual({ date: "2012-07-15", granularity: "month", rest: "" });
  });
});

describe("extractDate — other written forms", () => {
  it.each([
    ["April 28, 2012", "2012-04-28", "day"],
    ["april 28th 2012", "2012-04-28", "day"],
    ["28 April 2012", "2012-04-28", "day"],
    ["28th of april 2012", "2012-04-28", "day"],
    ["4/28/2012", "2012-04-28", "day"],
    ["28/04/2012", "2012-04-28", "day"],
    ["2012/04/28", "2012-04-28", "day"],
    ["2012-04", "2012-04-15", "month"],
    ["apr 2012", "2012-04-15", "month"],
    ["Sept 2012", "2012-09-15", "month"],
    ["september of 1999", "1999-09-15", "month"],
    ["spring 2012", "2012-04-15", "month"],
    ["fall 2012", "2012-10-15", "month"],
    ["autumn 2012", "2012-10-15", "month"],
    ["winter 2012", "2012-01-15", "month"],
    ["summer '09", "2009-07-15", "month"],
    ["1999", "1999-06-15", "year"],
  ] as const)("%s → %s (%s)", (q, date, granularity) => {
    const got = extractDate(q);
    expect(got).not.toBeNull();
    expect(got!.date).toBe(date);
    expect(got!.granularity).toBe(granularity);
    expect(got!.rest).toBe("");
  });

  it("a decade flies to its middle year, year granularity", () => {
    expect(extractDate("the 90s")).toEqual({ date: "1995-06-15", granularity: "year", rest: "" });
    expect(extractDate("1990s")?.date).toBe("1995-06-15");
    expect(extractDate("'80s")?.date).toBe("1985-06-15");
    expect(extractDate("00s")?.date).toBe("2005-06-15");
    expect(extractDateDetail("the 90s")?.label).toBe("the 1990s");
  });

  it("an apostrophe year pivots on the current year", () => {
    expect(extractDate("'69")?.date).toBe("1969-06-15");
    expect(extractDate("'05")?.date).toBe("2005-06-15");
  });

  it("strips the joining word and punctuation before the date from the rest", () => {
    expect(extractDate("Cuz My Gear, in 2012")?.rest).toBe("Cuz My Gear");
    expect(extractDate("cuz my gear back in 2012")?.rest).toBe("cuz my gear");
    expect(extractDate("cuz my gear around summer 2012")?.rest).toBe("cuz my gear");
  });

  it("a date in the middle of the text is lifted out", () => {
    expect(extractDate("cuz my gear 2012 chief keef")).toEqual({
      date: "2012-06-15",
      granularity: "year",
      rest: "cuz my gear chief keef",
    });
  });

  it("early / mid / late are consumed with the year and keep year granularity", () => {
    expect(extractDate("cuz my gear early 2012")).toEqual({
      date: "2012-06-15",
      granularity: "year",
      rest: "cuz my gear",
    });
  });

  it("with two years, the last one is the date (the first can be a title)", () => {
    expect(extractDate("prince 1999 2012")).toEqual({
      date: "2012-06-15",
      granularity: "year",
      rest: "prince 1999",
    });
  });

  it('a bare "in" before the year stays (titles end in "in"); after a comma it goes', () => {
    expect(extractDate("let me in 2012")?.rest).toBe("let me in");
    expect(extractDate("let me in, in 2012")?.rest).toBe("let me in");
  });

  it("text with no date returns null", () => {
    expect(extractDate("7 years")).toBeNull();
    expect(extractDate("50 cent in da club")).toBeNull();
    expect(extractDate("21 savage")).toBeNull();
    expect(extractDate("cuz my gear")).toBeNull();
    expect(extractDate("")).toBeNull();
  });

  it("an impossible calendar day is not a date", () => {
    expect(extractDate("2012-02-30")).toBeNull();
    expect(extractDate("13/13/2012")).toBeNull();
  });

  it('"Summer of \'69" parses as a date here; the resolver decides it is a title', () => {
    expect(extractDate("summer of '69")).toEqual({ date: "1969-07-15", granularity: "month", rest: "" });
  });

  it("labels say what was understood", () => {
    expect(extractDateDetail("1999")?.label).toBe("1999 · year only");
    expect(extractDateDetail("March 2012")?.label).toBe("March 2012");
    expect(extractDateDetail("summer 2012")?.label).toBe("Summer 2012");
    expect(extractDateDetail("2012-04-28")?.label).toBe("28 Apr 2012");
  });

  it("never throws on hostile input", () => {
    expect(() => extractDate("\u0000\u0007((((([[[[")).not.toThrow();
    expect(() => extractDate("9".repeat(5000))).not.toThrow();
  });
});

describe("flightTarget", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CHART_START is the first Hot 100 issue", () => {
    expect(CHART_START).toBe("1958-08-04");
  });

  it("a year flies to mid-year, never Jan 1", () => {
    expect(flightTarget("2012", "year")).toBe("2012-06-15");
    expect(flightTarget("2012-01-01", "year")).toBe("2012-06-15");
    expect(flightTarget("2012-06-15", "year")).toBe("2012-06-15");
  });

  it("a month flies to the 15th", () => {
    expect(flightTarget("2012-03", "month")).toBe("2012-03-15");
    expect(flightTarget("2012-03-01", "month")).toBe("2012-03-15");
  });

  it("a day is kept", () => {
    expect(flightTarget("2012-04-28", "day")).toBe("2012-04-28");
  });

  it("clamps to the first chart week", () => {
    expect(flightTarget("1955-06-15", "year")).toBe(CHART_START);
    expect(flightTarget("1958", "year")).toBe(CHART_START);
    expect(flightTarget("1958-08-01", "day")).toBe(CHART_START);
  });

  it("clamps to today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
    expect(flightTarget("2030", "year")).toBe("2026-10-20");
    expect(flightTarget("2026-11", "month")).toBe("2026-10-20");
    expect(flightTarget("2026", "year")).toBe("2026-06-15");
  });

  it("is idempotent, and no year or month target lands on the 1st of January", () => {
    for (let y = 1959; y <= 2025; y++) {
      for (const g of ["year", "month"] as const) {
        const once = flightTarget(`${y}-01-01`, g);
        expect(once.endsWith("-01-01")).toBe(false);
        expect(flightTarget(once, g)).toBe(once);
      }
    }
  });

  it("an unparseable date falls back to today instead of throwing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
    expect(flightTarget("not a date", "day")).toBe("2026-10-20");
  });
});
