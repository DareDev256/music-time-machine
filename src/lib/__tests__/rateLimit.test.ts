import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  tryConsume,
  checkSpotifyLimit,
  checkGeniusLimit,
  checkRouteLimit,
  extractClientIp,
  rateLimitResponse,
  isValidId,
  sanitizeQuery,
} from "../rateLimit";

// The module uses a shared `buckets` Map and `lastEviction` timestamp.
// Re-importing between tests would share state, so we isolate via unique
// bucket names and fake timers to control time-dependent behavior.

describe("tryConsume — token bucket core", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the token limit", () => {
    const name = "test-allow-" + Date.now();
    expect(tryConsume(name, 3, 60_000)).toBe(true);
    expect(tryConsume(name, 3, 60_000)).toBe(true);
    expect(tryConsume(name, 3, 60_000)).toBe(true);
  });

  it("rejects when tokens are exhausted", () => {
    const name = "test-exhaust-" + Date.now();
    tryConsume(name, 2, 60_000);
    tryConsume(name, 2, 60_000);
    expect(tryConsume(name, 2, 60_000)).toBe(false);
  });

  it("refills tokens over time", () => {
    const name = "test-refill-" + Date.now();
    // Bucket: 2 tokens per 1000ms → 1 token per 500ms
    tryConsume(name, 2, 1000);
    tryConsume(name, 2, 1000);
    expect(tryConsume(name, 2, 1000)).toBe(false);

    // Advance 500ms → ~1 token refilled
    vi.advanceTimersByTime(500);
    expect(tryConsume(name, 2, 1000)).toBe(true);
  });

  it("never exceeds max tokens after long idle", () => {
    const name = "test-cap-" + Date.now();
    tryConsume(name, 3, 1000); // starts at 3, consume 1 → 2

    // Wait way longer than needed for a full refill
    vi.advanceTimersByTime(100_000);

    // Should be capped at 3, so consume 3 then fail
    expect(tryConsume(name, 3, 1000)).toBe(true);
    expect(tryConsume(name, 3, 1000)).toBe(true);
    expect(tryConsume(name, 3, 1000)).toBe(true);
    expect(tryConsume(name, 3, 1000)).toBe(false);
  });
});

describe("pre-configured API limiters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checkSpotifyLimit allows 30 requests then blocks", () => {
    for (let i = 0; i < 30; i++) {
      expect(checkSpotifyLimit()).toBe(true);
    }
    expect(checkSpotifyLimit()).toBe(false);
  });

  it("checkGeniusLimit allows 50 requests then blocks", () => {
    for (let i = 0; i < 50; i++) {
      expect(checkGeniusLimit()).toBe(true);
    }
    expect(checkGeniusLimit()).toBe(false);
  });
});

describe("checkRouteLimit — per-IP rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks limits per-IP independently", () => {
    // Exhaust limit for IP-A on search route (20/min)
    for (let i = 0; i < 20; i++) {
      checkRouteLimit("search", "1.2.3.4");
    }
    expect(checkRouteLimit("search", "1.2.3.4")).toBe(false);

    // IP-B should still have tokens
    expect(checkRouteLimit("search", "5.6.7.8")).toBe(true);
  });

  it("tracks limits per-route independently", () => {
    // Exhaust search limit for this IP
    for (let i = 0; i < 20; i++) {
      checkRouteLimit("search", "10.0.0.1");
    }
    expect(checkRouteLimit("search", "10.0.0.1")).toBe(false);

    // Same IP, different route should still work
    expect(checkRouteLimit("song", "10.0.0.1")).toBe(true);
  });
});

describe("extractClientIp — spoofing protection", () => {
  it("extracts first valid IP from X-Forwarded-For", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.50");
  });

  it("falls back to X-Real-IP", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = new Request("http://localhost");
    expect(extractClientIp(req)).toBe("unknown");
  });

  it("rejects spoofed non-IP strings in X-Forwarded-For", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "fake-ip-bypass-1234" },
    });
    expect(extractClientIp(req)).toBe("unknown-invalid");
  });

  it("rejects SQL injection in X-Forwarded-For", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "127.0.0.1 OR 1=1" },
    });
    expect(extractClientIp(req)).toBe("unknown-invalid");
  });

  it("rejects spoofed non-IP strings in X-Real-IP", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "not-an-ip" },
    });
    expect(extractClientIp(req)).toBe("unknown-invalid");
  });

  it("accepts valid IPv6 addresses", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(extractClientIp(req)).toBe("2001:db8::1");
  });

  it("funnels all spoofed IPs into a shared bucket", () => {
    // Two different spoofed values → same fallback → same rate limit bucket
    const req1 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "spoof-attempt-1" },
    });
    const req2 = new Request("http://localhost", {
      headers: { "x-forwarded-for": "spoof-attempt-2" },
    });
    expect(extractClientIp(req1)).toBe(extractClientIp(req2));
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 status with Retry-After header", async () => {
    const res = rateLimitResponse();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });
});

describe("isValidId", () => {
  it("accepts alphanumeric IDs with dashes and colons", () => {
    expect(isValidId("blinding-lights")).toBe(true);
    expect(isValidId("spotify:track:123abc")).toBe(true);
    expect(isValidId("ABC123")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidId("")).toBe(false);
  });

  it("rejects IDs with special characters", () => {
    expect(isValidId("test<script>")).toBe(false);
    expect(isValidId("path/../traversal")).toBe(false);
    expect(isValidId("hello world")).toBe(false);
    expect(isValidId("id;DROP TABLE")).toBe(false);
  });

  it("rejects IDs exceeding 200 characters", () => {
    expect(isValidId("a".repeat(201))).toBe(false);
    expect(isValidId("a".repeat(200))).toBe(true);
  });
});

describe("sanitizeQuery", () => {
  it("strips HTML tags but preserves inner text", () => {
    // Tags are removed; text content inside tags survives (it's no longer executable)
    expect(sanitizeQuery("<script>alert(1)</script>hello")).toBe("alert(1)hello");
    expect(sanitizeQuery("search <b>bold</b> term")).toBe("search bold term");
    expect(sanitizeQuery("<div>content</div>")).toBe("content");
  });

  it("removes dangerous characters", () => {
    expect(sanitizeQuery('test"<>&\'value')).toBe("testvalue");
  });

  it("trims whitespace", () => {
    expect(sanitizeQuery("  hello world  ")).toBe("hello world");
  });

  it("enforces 200 character limit", () => {
    const long = "a".repeat(300);
    expect(sanitizeQuery(long)).toHaveLength(200);
  });

  it("passes through clean queries unchanged", () => {
    expect(sanitizeQuery("Blinding Lights")).toBe("Blinding Lights");
    expect(sanitizeQuery("drake hotline bling")).toBe("drake hotline bling");
  });

  it("blocks prototype pollution payloads", () => {
    expect(sanitizeQuery("__proto__")).toBe("");
    expect(sanitizeQuery("constructor")).toBe("");
    expect(sanitizeQuery("prototype")).toBe("");
  });

  it("allows queries containing dangerous keys as substrings", () => {
    // "constructor" as a standalone query is blocked, but as part of a
    // natural search it's fine — nobody's doing bracket notation on this.
    expect(sanitizeQuery("the constructor song")).toBe("the constructor song");
    expect(sanitizeQuery("prototype records")).toBe("prototype records");
  });

  it("strips null bytes that could truncate downstream parsers", () => {
    expect(sanitizeQuery("photo\x00.js")).toBe("photo.js");
    expect(sanitizeQuery("search\x00term")).toBe("searchterm");
    expect(sanitizeQuery("\x00\x00\x00")).toBe("");
  });

  it("strips unicode control characters (C0/C1 ranges)", () => {
    // Tab (\x09), newline (\x0A), carriage return (\x0D) — legitimate in
    // text but meaningless in a search query; can confuse WAFs and logs.
    expect(sanitizeQuery("line\x0Abreak")).toBe("linebreak");
    expect(sanitizeQuery("tab\x09here")).toBe("tabhere");
    expect(sanitizeQuery("cr\x0Dlf")).toBe("crlf");
    // C1 range (U+0080–U+009F) — rarely used, can break parsers
    expect(sanitizeQuery("test\x85value")).toBe("testvalue");
    expect(sanitizeQuery("test\x8Dvalue")).toBe("testvalue");
  });
});
