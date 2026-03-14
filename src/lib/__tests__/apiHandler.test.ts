import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRouteHandler, jsonWithCache, generateRequestId } from "../apiHandler";
import { NextRequest, NextResponse } from "next/server";

// Mock the rateLimit module — apiHandler depends on it for every request
vi.mock("../rateLimit", () => ({
  extractClientIp: vi.fn(() => "127.0.0.1"),
  checkRouteLimit: vi.fn(() => true),
  rateLimitResponse: vi.fn(
    (requestId?: string) => {
      const headers: Record<string, string> = { "Retry-After": "60" };
      if (requestId) headers["X-Request-ID"] = requestId;
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
    }
  ),
}));

import { checkRouteLimit, extractClientIp } from "../rateLimit";

function makeRequest(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

const dummyContext = { params: Promise.resolve({}) };

describe("withRouteHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes request through to handler when rate limit allows", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler({ route: "search" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);
    const body = await res.json();

    expect(handler).toHaveBeenCalledOnce();
    expect(body).toEqual({ ok: true });
  });

  it("extracts client IP and checks route limit", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const wrapped = withRouteHandler({ route: "song" }, handler);

    await wrapped(makeRequest(), dummyContext);

    expect(extractClientIp).toHaveBeenCalledOnce();
    expect(checkRouteLimit).toHaveBeenCalledWith("song", "127.0.0.1");
  });

  it("returns 429 when rate limit is exceeded (handler never called)", async () => {
    vi.mocked(checkRouteLimit).mockReturnValueOnce(false);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler({ route: "search" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });

  it("catches handler errors and returns generic 500 (no stack leak)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("Spotify API key invalid — sk-secret123");
    });
    const wrapped = withRouteHandler({ route: "song" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);
    const body = await res.json();

    expect(res.status).toBe(500);
    // Response must NOT leak the original error message or secrets
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("sk-secret");
    // But the error IS logged server-side for debugging
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("API error [song]")
    );
    consoleSpy.mockRestore();
  });

  it("handles non-Error thrown values gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw "string error"; // not an Error instance
    });
    const wrapped = withRouteHandler({ route: "compare" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);

    expect(res.status).toBe(500);
    // Should log "Unknown error" for non-Error values
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown error")
    );
    consoleSpy.mockRestore();
  });

  it("forwards context (params) to the handler", async () => {
    const params = Promise.resolve({ id: "blinding-lights" });
    const handler = vi.fn(async (_req, ctx) => {
      const resolved = await ctx.params;
      return NextResponse.json({ id: resolved.id });
    });
    const wrapped = withRouteHandler({ route: "song" }, handler);

    const res = await wrapped(makeRequest(), { params });
    const body = await res.json();

    expect(body.id).toBe("blinding-lights");
  });
});

describe("jsonWithCache", () => {
  it("returns JSON response with Cache-Control header", async () => {
    const data = { songs: [{ id: "1", title: "Test" }] };
    const res = jsonWithCache(data, "public, max-age=300, s-maxage=600");

    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=600");
    const body = await res.json();
    expect(body).toEqual(data);
  });

  it("handles empty data", async () => {
    const res = jsonWithCache(null, "no-store");
    const body = await res.json();
    expect(body).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("X-Request-ID traceability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates valid UUID v4 request IDs", () => {
    const id = generateRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRequestId()));
    expect(ids.size).toBe(50);
  });

  it("attaches X-Request-ID to successful responses", async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler({ route: "search" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);
    const requestId = res.headers.get("X-Request-ID");

    expect(requestId).toBeTruthy();
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("attaches X-Request-ID to 500 error responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => { throw new Error("boom"); });
    const wrapped = withRouteHandler({ route: "song" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);

    expect(res.status).toBe(500);
    expect(res.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("attaches X-Request-ID to 429 rate limit responses", async () => {
    vi.mocked(checkRouteLimit).mockReturnValueOnce(false);
    const handler = vi.fn(async () => NextResponse.json({}));
    const wrapped = withRouteHandler({ route: "search" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);

    expect(res.status).toBe(429);
    expect(res.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("includes request ID in error log messages", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => { throw new Error("db timeout"); });
    const wrapped = withRouteHandler({ route: "compare" }, handler);

    const res = await wrapped(makeRequest(), dummyContext);
    const requestId = res.headers.get("X-Request-ID");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`req=${requestId}`)
    );
    consoleSpy.mockRestore();
  });
});
