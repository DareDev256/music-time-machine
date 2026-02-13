import { describe, it, expect } from "vitest";
import {
  getChartForDate,
  findClosestChart,
  historicalNumber1s,
  type ChartEntry,
} from "../timeMachine";

// ── getChartForDate ─────────────────────────────────────────────────

describe("getChartForDate", () => {
  it("returns exact match for a populated month", () => {
    // January 15, 2024 → key "2024-01" → "Lovin On Me"
    const result = getChartForDate(new Date(2024, 0, 15));
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Lovin On Me");
    expect(result!.artist).toBe("Jack Harlow");
  });

  it("zero-pads single-digit months correctly", () => {
    // April 2019 → key "2019-04" → "Old Town Road"
    const result = getChartForDate(new Date(2019, 3, 1));
    expect(result).not.toBeNull();
    expect(result!.id).toBe("old-town-road");
  });

  it("returns null for a month with no data", () => {
    // February 2019 — not in the dataset
    expect(getChartForDate(new Date(2019, 1, 14))).toBeNull();
  });

  it("returns null for dates before coverage range", () => {
    expect(getChartForDate(new Date(2018, 5, 1))).toBeNull();
  });

  it("returns null for dates after coverage range", () => {
    expect(getChartForDate(new Date(2025, 6, 1))).toBeNull();
  });

  it("handles last day of month (still same month key)", () => {
    // March 31, 2024 → key "2024-03" → "Espresso"
    const result = getChartForDate(new Date(2024, 2, 31));
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Espresso");
  });

  it("handles leap day correctly", () => {
    // Feb 29, 2024 → key "2024-02" → "Texas Hold 'Em"
    const result = getChartForDate(new Date(2024, 1, 29));
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Texas Hold 'Em");
  });

  it("returns full ChartEntry shape with weeksAtOne", () => {
    const result = getChartForDate(new Date(2019, 3, 10));
    expect(result).toMatchObject({
      position: 1,
      title: "Old Town Road",
      artist: expect.any(String),
      albumArt: expect.stringContaining("https://"),
      id: "old-town-road",
      weeksAtOne: 19,
    });
  });
});

// ── findClosestChart ────────────────────────────────────────────────

describe("findClosestChart", () => {
  it("returns exact month when it exists in the data", () => {
    const result = findClosestChart(new Date(2023, 0, 20));
    expect(result).not.toBeNull();
    expect(result!.monthKey).toBe("2023-01");
    expect(result!.entry.title).toBe("Flowers");
  });

  it("finds closest month when exact month is missing", () => {
    // March 2023 is not in data. Closest populated: 2023-04 (April)
    const result = findClosestChart(new Date(2023, 2, 15));
    expect(result).not.toBeNull();
    expect(result!.monthKey).toBe("2023-04");
  });

  it("snaps to nearest boundary for dates before data range", () => {
    // Jan 2017 — far before any data. Should snap to earliest entry (2019-04)
    const result = findClosestChart(new Date(2017, 0, 1));
    expect(result).not.toBeNull();
    // Earliest entry in the dataset is 2019-04
    expect(result!.monthKey).toBe("2019-04");
  });

  it("snaps to nearest boundary for dates after data range", () => {
    // Dec 2026 — far after any data. Should snap to latest entry (2024-03)
    const result = findClosestChart(new Date(2026, 11, 1));
    expect(result).not.toBeNull();
    expect(result!.monthKey).toBe("2024-03");
  });

  it("returns null when given an empty dataset", () => {
    const result = findClosestChart(new Date(2023, 5, 1), {});
    expect(result).toBeNull();
  });

  it("works with a custom single-entry dataset", () => {
    const custom: Record<string, ChartEntry> = {
      "2022-06": {
        position: 1,
        title: "Test Song",
        artist: "Test Artist",
        albumArt: "",
        id: "test",
      },
    };
    const result = findClosestChart(new Date(2025, 0, 1), custom);
    expect(result).not.toBeNull();
    expect(result!.entry.title).toBe("Test Song");
    expect(result!.monthKey).toBe("2022-06");
  });

  it("picks the nearer of two equidistant-ish months", () => {
    // Custom dataset with two entries 2 months apart
    const custom: Record<string, ChartEntry> = {
      "2022-01": { position: 1, title: "Jan", artist: "A", albumArt: "", id: "jan" },
      "2022-03": { position: 1, title: "Mar", artist: "A", albumArt: "", id: "mar" },
    };
    // Feb 1 is closer to Jan-15 (~17 days) than Mar-15 (~42 days)
    const result = findClosestChart(new Date(2022, 1, 1), custom);
    expect(result!.monthKey).toBe("2022-01");
  });
});

// ── historicalNumber1s data integrity ───────────────────────────────

describe("historicalNumber1s", () => {
  it("has entries spanning 2019 through 2024", () => {
    const years = new Set(Object.keys(historicalNumber1s).map((k) => k.split("-")[0]));
    expect(years).toContain("2019");
    expect(years).toContain("2024");
  });

  it("all keys are valid YYYY-MM format", () => {
    for (const key of Object.keys(historicalNumber1s)) {
      expect(key).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });

  it("every entry has required fields", () => {
    for (const [key, entry] of Object.entries(historicalNumber1s)) {
      expect(entry.position, `${key} missing position`).toBe(1);
      expect(entry.title, `${key} missing title`).toBeTruthy();
      expect(entry.artist, `${key} missing artist`).toBeTruthy();
      expect(entry.id, `${key} missing id`).toBeTruthy();
    }
  });

  it("has no duplicate song IDs across different months", () => {
    const ids = Object.values(historicalNumber1s).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
