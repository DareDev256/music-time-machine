import { describe, it, expect } from "vitest";
import { assertAllowedOrigin, sanitizeJson } from "../safeFetch";

describe("assertAllowedOrigin", () => {
  it("allows Spotify API origin", () => {
    expect(() => assertAllowedOrigin("https://api.spotify.com/v1/tracks/abc")).not.toThrow();
  });

  it("allows Spotify accounts origin", () => {
    expect(() => assertAllowedOrigin("https://accounts.spotify.com/api/token")).not.toThrow();
  });

  it("allows YouTube API origin", () => {
    expect(() => assertAllowedOrigin("https://www.googleapis.com/youtube/v3/search?q=test")).not.toThrow();
  });

  it("allows Genius API origin", () => {
    expect(() => assertAllowedOrigin("https://api.genius.com/songs/123")).not.toThrow();
  });

  it("blocks cloud metadata endpoint (169.254.169.254)", () => {
    expect(() => assertAllowedOrigin("http://169.254.169.254/latest/meta-data/")).toThrow("SSRF blocked");
  });

  it("blocks localhost", () => {
    expect(() => assertAllowedOrigin("http://localhost:3000/api/secret")).toThrow("SSRF blocked");
  });

  it("blocks internal IPs", () => {
    expect(() => assertAllowedOrigin("http://10.0.0.1/admin")).toThrow("SSRF blocked");
  });

  it("blocks arbitrary external domains", () => {
    expect(() => assertAllowedOrigin("https://evil.com/steal?data=secret")).toThrow("SSRF blocked");
  });

  it("blocks origin with @ credential trick", () => {
    // URL spec: https://user:pass@host/ — the host after @ is the real target
    expect(() => assertAllowedOrigin("https://api.spotify.com@evil.com/path")).toThrow("SSRF blocked");
  });

  it("blocks malformed URLs", () => {
    expect(() => assertAllowedOrigin("not-a-url")).toThrow("SSRF blocked: malformed URL");
  });

  it("blocks HTTP downgrade of allowed origins", () => {
    // Our allowlist only has https:// origins
    expect(() => assertAllowedOrigin("http://api.spotify.com/v1/tracks")).toThrow("SSRF blocked");
  });

  it("blocks subdomain spoofing", () => {
    expect(() => assertAllowedOrigin("https://api.spotify.com.evil.com/v1/tracks")).toThrow("SSRF blocked");
  });
});

describe("sanitizeJson", () => {
  it("passes through clean objects unchanged", () => {
    const input = { tracks: { items: [{ id: "abc", name: "Song" }] } };
    expect(sanitizeJson(input)).toEqual(input);
  });

  it("strips __proto__ keys from objects", () => {
    // Force __proto__ as an own property via null-prototype object
    const obj = Object.create(null);
    obj.name = "safe";
    obj["__proto__"] = { isAdmin: true };
    const result = sanitizeJson(obj) as Record<string, unknown>;
    expect(result).toEqual({ name: "safe" });
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(false);
  });

  it("strips constructor and prototype keys", () => {
    const obj = Object.create(null);
    obj.data = "ok";
    obj["constructor"] = { payload: true };
    obj["prototype"] = { injected: true };
    const result = sanitizeJson(obj);
    expect(result).toEqual({ data: "ok" });
  });

  it("sanitizes nested objects recursively", () => {
    const obj = Object.create(null);
    const nested = Object.create(null);
    nested.valid = 1;
    nested["__proto__"] = { evil: true };
    obj.response = nested;
    const result = sanitizeJson(obj) as { response: Record<string, unknown> };
    expect(result.response).toEqual({ valid: 1 });
  });

  it("sanitizes arrays of objects", () => {
    const item = Object.create(null);
    item.id = 1;
    item["__proto__"] = { x: true };
    const result = sanitizeJson([item]);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("returns primitives unchanged", () => {
    expect(sanitizeJson("hello")).toBe("hello");
    expect(sanitizeJson(42)).toBe(42);
    expect(sanitizeJson(null)).toBeNull();
    expect(sanitizeJson(true)).toBe(true);
  });

  it("caps recursion depth to prevent stack overflow", () => {
    // Build a 25-level nested object — sanitizer stops stripping at depth 20
    let obj: Record<string, unknown> = { clean: true };
    for (let i = 0; i < 25; i++) {
      obj = { nested: obj };
    }
    // Should not throw — just returns as-is past MAX_DEPTH
    expect(() => sanitizeJson(obj)).not.toThrow();
  });
});
