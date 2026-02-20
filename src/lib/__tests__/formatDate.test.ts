import { describe, it, expect } from "vitest";
import { formatDate } from "../formatDate";

describe("formatDate", () => {
  it("formats valid ISO date to long US format", () => {
    // Use a timezone-safe format (Date constructor treats "2024-01-15" as UTC,
    // but toLocaleDateString renders in local time — day may shift by ±1)
    const result = formatDate("2024-01-15");
    expect(result).toContain("January");
    expect(result).toContain("2024");
  });

  it("returns raw input for unparseable date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("TBD")).toBe("TBD");
  });

  it("accepts custom Intl options", () => {
    const result = formatDate("2024-01-15", { month: "short", day: "numeric", year: "numeric" });
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });

  it("handles empty string without crashing", () => {
    // Empty string is unparseable — should return as-is
    expect(formatDate("")).toBe("");
  });

  it("formats year-only strings without crashing", () => {
    // "2024" is valid per Date.parse — may render as Dec 31 2023 in behind-UTC timezones
    const result = formatDate("2024");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
