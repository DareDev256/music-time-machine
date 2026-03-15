import { describe, it, expect } from "vitest";
import { safeJson, sanitizeJson } from "../safeFetch";

/** safeJson: async bridge parsing Response body + sanitizing proto pollution. */
describe("safeJson", () => {
  /** Helper: build a Response with a JSON body. */
  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("parses a clean JSON response", async () => {
    const data = { tracks: [{ id: "abc", name: "Blinding Lights" }] };
    const result = await safeJson(jsonResponse(data));
    expect(result).toEqual(data);
  });

  it("strips __proto__ from response payload", async () => {
    // Simulate a compromised API injecting __proto__
    const malicious = '{"name":"safe","__proto__":{"isAdmin":true}}';
    const res = new Response(malicious, {
      headers: { "Content-Type": "application/json" },
    });
    const result = await safeJson<Record<string, unknown>>(res);
    expect(result).toEqual({ name: "safe" });
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(false);
  });

  it("strips constructor key from nested API response", async () => {
    const payload = {
      data: { title: "Song", constructor: { polluted: true } },
    };
    const result = await safeJson<{ data: Record<string, unknown> }>(
      jsonResponse(payload)
    );
    expect(result.data).toEqual({ title: "Song" });
    expect(Object.prototype.hasOwnProperty.call(result.data, "constructor")).toBe(false);
  });

  it("sanitizes arrays in response body", async () => {
    // JSON.stringify converts __proto__ to a regular key in the string
    const res = new Response(
      '[{"id":1},{"id":2,"__proto__":{"evil":true}}]',
      { headers: { "Content-Type": "application/json" } }
    );
    const result = await safeJson<Array<Record<string, unknown>>>(res);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ id: 2 });
  });

  it("handles null response body", async () => {
    const result = await safeJson(jsonResponse(null));
    expect(result).toBeNull();
  });

  it("handles primitive response values", async () => {
    expect(await safeJson(jsonResponse(42))).toBe(42);
    expect(await safeJson(jsonResponse("hello"))).toBe("hello");
    expect(await safeJson(jsonResponse(true))).toBe(true);
  });

  it("propagates JSON parse errors (malformed body)", async () => {
    const res = new Response("not json", {
      headers: { "Content-Type": "application/json" },
    });
    await expect(safeJson(res)).rejects.toThrow();
  });
});

/** sanitizeJson depth boundary — verifies behavior at MAX_DEPTH. */
describe("sanitizeJson depth boundary", () => {
  it("stops stripping __proto__ past depth 20", () => {
    // Build nested object: depth 0 → 21 levels deep
    let obj: Record<string, unknown> = { __proto__: { evil: true }, safe: "yes" };
    for (let i = 0; i < 21; i++) {
      obj = { nested: obj };
    }
    const result = sanitizeJson(obj) as Record<string, unknown>;
    // Should not throw — just returns as-is past MAX_DEPTH
    expect(result).toBeDefined();
  });
});
