import { describe, it, expect } from "vitest";
import {
  validateParamCount,
  parseStringParam,
  parseIntParam,
  parsePagination,
  parseEnumParam,
} from "../requestUtils";

/** Helper to build URLSearchParams from entries (supports duplicate keys). */
function params(entries: [string, string][]): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of entries) p.append(k, v);
  return p;
}

function q(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

// ── validateParamCount ───────────────────────────────────────────────

describe("validateParamCount", () => {
  it("allows requests within the param limit", () => {
    expect(validateParamCount(q({ a: "1", b: "2" })).ok).toBe(true);
  });

  it("rejects requests exceeding 20 params", () => {
    const entries: [string, string][] = Array.from({ length: 21 }, (_, i) => [`p${i}`, "v"]);
    const result = validateParamCount(params(entries));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toMatch(/maximum/i);
  });
});

// ── parseStringParam ─────────────────────────────────────────────────

describe("parseStringParam", () => {
  it("extracts a valid string param", () => {
    const result = parseStringParam(q({ name: "Beatles" }), "name");
    expect(result).toEqual({ ok: true, value: "Beatles" });
  });

  it("returns null for missing optional param", () => {
    const result = parseStringParam(q({}), "name");
    expect(result).toEqual({ ok: true, value: null });
  });

  it("errors on missing required param", () => {
    const result = parseStringParam(q({}), "name", { required: true });
    expect(result.ok).toBe(false);
  });

  it("detects HTTP parameter pollution (duplicate keys)", () => {
    const result = parseStringParam(params([["sort", "name"], ["sort", "DROP TABLE"]]), "sort");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toMatch(/duplicate/i);
  });

  it("rejects control characters (CRLF injection)", () => {
    const result = parseStringParam(q({ q: "search\r\nX-Injected: true" }), "q");
    expect(result.ok).toBe(false);
  });

  it("rejects null bytes", () => {
    const result = parseStringParam(q({ q: "file\x00.js" }), "q");
    expect(result.ok).toBe(false);
  });

  it("rejects values exceeding max length", () => {
    const result = parseStringParam(q({ q: "x".repeat(501) }), "q");
    expect(result.ok).toBe(false);
  });

  it("blocks prototype pollution payloads", () => {
    expect(parseStringParam(q({ key: "__proto__" }), "key").ok).toBe(false);
    expect(parseStringParam(q({ key: "constructor" }), "key").ok).toBe(false);
    expect(parseStringParam(q({ key: "prototype" }), "key").ok).toBe(false);
  });

  it("trims whitespace from values", () => {
    const result = parseStringParam(q({ q: "  hello  " }), "q");
    expect(result).toEqual({ ok: true, value: "hello" });
  });
});

// ── parseIntParam ────────────────────────────────────────────────────

describe("parseIntParam", () => {
  it("parses a valid integer", () => {
    const result = parseIntParam(q({ page: "5" }), "page", { min: 1, max: 100 });
    expect(result).toEqual({ ok: true, value: 5 });
  });

  it("returns default for missing param", () => {
    const result = parseIntParam(q({}), "page", { defaultValue: 1 });
    expect(result).toEqual({ ok: true, value: 1 });
  });

  it("rejects scientific notation (type coercion attack)", () => {
    expect(parseIntParam(q({ n: "1e5" }), "n").ok).toBe(false);
  });

  it("rejects floats", () => {
    expect(parseIntParam(q({ n: "3.14" }), "n").ok).toBe(false);
  });

  it("rejects hex notation", () => {
    expect(parseIntParam(q({ n: "0xFF" }), "n").ok).toBe(false);
  });

  it("rejects NaN and Infinity strings", () => {
    expect(parseIntParam(q({ n: "NaN" }), "n").ok).toBe(false);
    expect(parseIntParam(q({ n: "Infinity" }), "n").ok).toBe(false);
  });

  it("rejects values beyond safe integer range", () => {
    expect(parseIntParam(q({ n: "99999999999999999" }), "n").ok).toBe(false);
  });

  it("enforces minimum bound", () => {
    const result = parseIntParam(q({ page: "0" }), "page", { min: 1 });
    expect(result.ok).toBe(false);
  });

  it("enforces maximum bound", () => {
    const result = parseIntParam(q({ limit: "9999" }), "limit", { max: 100 });
    expect(result.ok).toBe(false);
  });

  it("rejects mixed alphanumeric (parseInt would silently coerce)", () => {
    expect(parseIntParam(q({ n: "123abc" }), "n").ok).toBe(false);
  });
});

// ── parsePagination ──────────────────────────────────────────────────

describe("parsePagination", () => {
  it("returns defaults when no params given", () => {
    const result = parsePagination(q({}));
    expect(result).toEqual({ ok: true, value: { page: 1, limit: 20, offset: 0 } });
  });

  it("computes offset correctly", () => {
    const result = parsePagination(q({ page: "3", limit: "10" }));
    expect(result).toEqual({ ok: true, value: { page: 3, limit: 10, offset: 20 } });
  });

  it("rejects page=0", () => {
    expect(parsePagination(q({ page: "0" })).ok).toBe(false);
  });

  it("rejects limit exceeding max", () => {
    expect(parsePagination(q({ limit: "500" })).ok).toBe(false);
  });

  it("respects custom bounds", () => {
    const result = parsePagination(q({ limit: "50" }), { maxLimit: 50, defaultLimit: 10 });
    expect(result).toEqual({ ok: true, value: { page: 1, limit: 50, offset: 0 } });
  });
});

// ── parseEnumParam ───────────────────────────────────────────────────

describe("parseEnumParam", () => {
  const sortFields = new Set(["title", "artist", "year"] as const);

  it("accepts a valid enum value", () => {
    const result = parseEnumParam(q({ sort: "title" }), "sort", sortFields);
    expect(result).toEqual({ ok: true, value: "title" });
  });

  it("rejects values not in the allowlist", () => {
    const result = parseEnumParam(q({ sort: "DROP TABLE" }), "sort", sortFields);
    expect(result.ok).toBe(false);
  });

  it("returns default for missing optional param", () => {
    const result = parseEnumParam(q({}), "sort", sortFields, { defaultValue: "title" });
    expect(result).toEqual({ ok: true, value: "title" });
  });

  it("is case-sensitive (no sneaky bypasses)", () => {
    expect(parseEnumParam(q({ sort: "Title" }), "sort", sortFields).ok).toBe(false);
    expect(parseEnumParam(q({ sort: "YEAR" }), "sort", sortFields).ok).toBe(false);
  });
});
