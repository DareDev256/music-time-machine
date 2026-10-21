// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const KEY = "test-key-never-logged";
const search = (title: string, publishedAt = "2015-02-10") => ({
  items: [{ id: { videoId: "E7ZStZMn-ac" }, snippet: { title, channelTitle: "6ixBuzz Premieres", publishedAt: `${publishedAt}T05:00:00Z`, liveBroadcastContent: "none" } }],
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let errors: ReturnType<typeof vi.spyOn>;
async function get(q: string | null, ip = "203.0.113.9") {
  const { GET } = await import("@/app/api/youtube/route");
  const url = q === null ? "http://localhost/api/youtube" : `http://localhost/api/youtube?q=${encodeURIComponent(q)}`;
  return GET(new Request(url, { headers: { "x-forwarded-for": ip } }));
}

beforeEach(() => {
  vi.resetModules(); // a fresh instance: empty cache, full budget
  vi.stubEnv("YOUTUBE_API_KEY", KEY);
  fetchMock = vi.fn(async () => ok(search("Casper TNG Ft Fresh - Dope Boy (Official Video)")));
  vi.stubGlobal("fetch", fetchMock);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  errors.mockRestore();
});

describe("GET /api/youtube", () => {
  it("validates q", async () => {
    expect((await get(null)).status).toBe(400);
    expect((await get("   ")).status).toBe(400);
    expect((await get("x".repeat(201))).status).toBe(400);
    expect((await get("a\u0007b")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searches once, maps the rows, and serves the same words from cache", async () => {
    const res = await get("casper dopeboy");
    expect(res.headers.get("x-youtube")).toBe("live");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
    const { rows } = (await res.json()) as { rows: Array<{ song: string; date: string; youtubeId: string }> };
    expect(rows[0]).toMatchObject({ song: "Dope Boy", date: "2015-02-10", youtubeId: "E7ZStZMn-ac" });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("q=casper%20dopeboy");
    expect(url).toContain("type=video");

    const again = await get("  Casper   DOPEBOY ");
    expect(again.headers.get("x-youtube")).toBe("cached");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers empty, uncached, without a key", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const res = await get("casper dopeboy");
    expect(res.headers.get("x-youtube")).toBe("unconfigured");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pauses after quotaExceeded instead of retrying into it, and never logs the key", async () => {
    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: "quotaExceeded" }] } }), { status: 403 }));
    const first = await get("casper dopeboy");
    expect(first.headers.get("x-youtube")).toBe("error");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(((await first.json()) as { rows: unknown[] }).rows).toEqual([]);
    const second = await get("pressa novacane");
    expect(second.headers.get("x-youtube")).toBe("paused");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls.flat().join(" ")).not.toContain(KEY);
  });

  it("limits one visitor to 10 live searches an hour; cached answers do not count", async () => {
    for (let i = 0; i < 10; i++) expect((await get(`song number ${i}`)).status).toBe(200);
    expect((await get("song number 0")).status).toBe(200); // cached
    expect((await get("one more song")).status).toBe(429);
    expect((await get("one more song", "198.51.100.4")).status).toBe(200);
  });

  it("stops at the instance's daily budget", async () => {
    for (let i = 0; i < 60; i++) await get(`budget song ${i}`, `10.0.${Math.floor(i / 10)}.${i}`);
    const res = await get("budget song 61", "10.9.9.9");
    expect(res.headers.get("x-youtube")).toBe("budget");
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });

  it("answers empty when YouTube times out or the network fails", async () => {
    fetchMock.mockImplementationOnce(async () => { throw new TypeError("fetch failed"); });
    const res = await get("casper dopeboy");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-youtube")).toBe("error");
  });
});
