import { describe, it, expect } from "vitest";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

// ── Helpers ────────────────────────────────────────────────────────────

function req(path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method });
}

// ── Path Traversal Blocking ────────────────────────────────────────────

describe("middleware › path traversal", () => {
  // NOTE: The URL constructor normalises bare `/../` and `/./` sequences
  // before the middleware sees the pathname — that's the URL spec protecting
  // us at a lower layer. The middleware's regex is defense-in-depth for
  // percent-encoded sequences that survive URL parsing.

  it("blocks percent-encoded slash + dot-dot (%2f..)", () => {
    const res = middleware(req("/api/%2f../secret"));
    expect(res.status).toBe(400);
  });

  it("URL spec normalises bare /../ before middleware sees it (safe by spec)", () => {
    // /../etc/passwd → /etc/passwd after URL parsing — traversal already
    // neutralised, so middleware correctly passes it through
    const res = middleware(req("/../etc/passwd"));
    expect(res.status).not.toBe(400);
  });

  it("allows clean paths through", () => {
    const res = middleware(req("/api/health"));
    expect(res.status).not.toBe(400);
  });

  it("allows paths with dots in filenames", () => {
    const res = middleware(req("/song/mr.brightside"));
    expect(res.status).not.toBe(400);
  });
});

// ── Method Restriction on API Routes ───────────────────────────────────

describe("middleware › method restriction", () => {
  const allowed = ["GET", "HEAD", "OPTIONS"];
  const blocked = ["POST", "PUT", "DELETE", "PATCH"];

  it.each(allowed)("allows %s on /api/ routes", (method) => {
    const res = middleware(req("/api/search", method));
    expect(res.status).not.toBe(405);
  });

  it.each(blocked)("blocks %s on /api/ routes with 405", (method) => {
    const res = middleware(req("/api/search", method));
    expect(res.status).toBe(405);
  });

  it("returns Allow header listing permitted methods", () => {
    const res = middleware(req("/api/song/123", "POST"));
    expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
  });

  it("returns JSON error body on 405", async () => {
    const res = middleware(req("/api/catalog", "DELETE"));
    const body = await res.json();
    expect(body).toEqual({ error: "Method not allowed" });
  });

  it("does NOT restrict methods on non-API routes", () => {
    const res = middleware(req("/song/123", "POST"));
    expect(res.status).not.toBe(405);
  });
});

// ── Request ID Injection ───────────────────────────────────────────────

describe("middleware › request ID", () => {
  it("sets X-Request-Id response header on normal requests", () => {
    const res = middleware(req("/api/health"));
    const id = res.headers.get("X-Request-Id");
    expect(id).toBeTruthy();
    // UUID v4 format
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique IDs per request", () => {
    const id1 = middleware(req("/")).headers.get("X-Request-Id");
    const id2 = middleware(req("/")).headers.get("X-Request-Id");
    expect(id1).not.toBe(id2);
  });
});

// ── X-Robots-Tag ───────────────────────────────────────────────────────

describe("middleware › X-Robots-Tag", () => {
  it("adds noindex, nofollow on API routes", () => {
    const res = middleware(req("/api/search"));
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("does NOT add X-Robots-Tag on page routes", () => {
    const res = middleware(req("/song/123"));
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });
});

// ── Edge Combinations ──────────────────────────────────────────────────

describe("middleware › edge cases", () => {
  it("traversal check takes priority over method check", () => {
    // POST to a path with encoded traversal → 400 (traversal), not 405 (method)
    const res = middleware(req("/api/%2f../secret", "POST"));
    expect(res.status).toBe(400);
  });

  it("root path passes cleanly", () => {
    const res = middleware(req("/"));
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(405);
  });
});
