// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const convex = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function () { return convex; }),
}));

import { ADMIN_COOKIE, adminSetCookie, cookieFromHeader, cookieValueFor, isAdminCookie, keyMatches, sameOrigin } from "../auth";
import { POST as session } from "../session/route";
import { POST as review } from "../review/route";

const TOKEN = "a".repeat(64);

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN;
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example-test.convex.cloud";
  process.env.CONVEX_SERVER_SECRET = "s".repeat(64);
  convex.mutation.mockReset().mockResolvedValue({ ok: true });
});

describe("admin cookie check", () => {
  it("accepts only the hash of the current token", () => {
    expect(isAdminCookie(cookieValueFor(TOKEN))).toBe(true);
    expect(isAdminCookie(TOKEN)).toBe(false); // the raw token is not a session
    expect(isAdminCookie(cookieValueFor("b".repeat(64)))).toBe(false);
    expect(isAdminCookie("")).toBe(false);
    expect(isAdminCookie(undefined)).toBe(false);
  });

  it("refuses everything when ADMIN_TOKEN is unset or too short", () => {
    delete process.env.ADMIN_TOKEN;
    expect(isAdminCookie(cookieValueFor(""))).toBe(false);
    expect(keyMatches("")).toBe(false);
    process.env.ADMIN_TOKEN = "short";
    expect(isAdminCookie(cookieValueFor("short"))).toBe(false);
    expect(keyMatches("short")).toBe(false);
    expect(adminSetCookie()).toBeNull();
  });

  it("rotating the token signs every old cookie out", () => {
    const old = cookieValueFor(TOKEN);
    process.env.ADMIN_TOKEN = "c".repeat(64);
    expect(isAdminCookie(old)).toBe(false);
  });

  it("sets an HttpOnly, Secure, SameSite=Strict cookie for 30 days, holding the hash", () => {
    const c = adminSetCookie()!;
    expect(c).toContain(`${ADMIN_COOKIE}=${cookieValueFor(TOKEN)}`);
    expect(c).not.toContain(TOKEN);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Max-Age=2592000/);
  });

  it("reads the cookie out of a Cookie header", () => {
    expect(cookieFromHeader(`a=1; ${ADMIN_COOKIE}=xyz; b=2`)).toBe("xyz");
    expect(cookieFromHeader("a=1")).toBeNull();
    expect(cookieFromHeader(null)).toBeNull();
  });

  it("same-origin check refuses another site's Origin", () => {
    const r = (origin?: string) => new Request("http://localhost:3419/api/admin/review", { headers: { host: "localhost:3419", ...(origin ? { origin } : {}) } });
    expect(sameOrigin(r("http://localhost:3419"))).toBe(true);
    expect(sameOrigin(r())).toBe(true);
    expect(sameOrigin(r("https://evil.example"))).toBe(false);
  });
});

describe("POST /api/admin/session", () => {
  const url = "http://localhost:3419/api/admin/session";
  const get = (key: string) => {
    const body = new FormData();
    body.set("key", key);
    return session(Object.assign(new Request(url, { method: "POST", body }), { nextUrl: new URL(url) }) as never);
  };

  it("a wrong key sets no cookie and goes back to the form with an error", async () => {
    const res = await get("nope");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3419/admin?error=key");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("the right key sets the cookie and refreshes to /admin", async () => {
    const res = await get(TOKEN);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${ADMIN_COOKIE}=${cookieValueFor(TOKEN)}`);
    expect(await res.text()).toContain('http-equiv="refresh" content="0;url=/admin"');
  });
});

describe("POST /api/admin/review", () => {
  const post = (body: unknown, cookie?: string, origin?: string) => {
    const url = "http://localhost:3419/api/admin/review";
    const r = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3419", ...(cookie ? { cookie: `${ADMIN_COOKIE}=${cookie}` } : {}), ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    });
    return review(Object.assign(r, { nextUrl: new URL(url) }) as never);
  };
  const body = { id: "k57abcdefghij0123456789", decision: "approved" };

  it("401 without the cookie, with a wrong cookie, or from another origin; Convex untouched", async () => {
    expect((await post(body)).status).toBe(401);
    expect((await post(body, cookieValueFor("x".repeat(64)))).status).toBe(401);
    expect((await post(body, cookieValueFor(TOKEN), "https://evil.example")).status).toBe(401);
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it("with the cookie: validates, then calls the mutation with the server secret", async () => {
    expect((await post({ id: "k57abcdefghij0123456789", decision: "maybe" }, cookieValueFor(TOKEN))).status).toBe(400);
    const res = await post({ ...body, note: "checked the upload" }, cookieValueFor(TOKEN));
    expect(res.status).toBe(200);
    expect(convex.mutation.mock.calls[0][1]).toEqual({ secret: "s".repeat(64), ...body, note: "checked the upload" });
  });
});
