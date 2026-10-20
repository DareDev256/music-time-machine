// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Convex: a fake client whose query (rate count) and mutation (create) we control and inspect.
const convex = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function () { return convex; }),
}));
// The own index: no 5.7 MB file read in a unit test.
const indexRow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/era/data", async (orig) => ({ ...(await orig<typeof import("@/lib/era/data")>()), indexRow }));

import { POST } from "../route";
import { checkSubmission, allowedLink, cleanText } from "../validate";

const fetchMock = vi.fn();

function req(body: unknown, headers: Record<string, string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: raw,
  }) as never;
}

const good = { song: "Cuz My Gear", artist: "Chief Keef", month: "2012-05" };

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example-test.convex.cloud";
  process.env.CONVEX_SERVER_SECRET = "s".repeat(64);
  process.env.IP_SALT = "t".repeat(64);
  convex.query.mockReset().mockResolvedValue(0);
  convex.mutation.mockReset().mockResolvedValue({ ok: true, id: "abc123" });
  indexRow.mockReset().mockReturnValue(null);
  fetchMock.mockReset().mockImplementation(async (url: URL) => {
    if (String(url).startsWith("https://musicbrainz.org/")) {
      return jsonResponse({ recordings: [
        { title: "Cuz My Gear", "first-release-date": "2012-05-17", "artist-credit": [{ name: "Chief Keef", joinphrase: " ft. " }, { name: "Riff Raff" }] },
        { title: "Cuz My Gear", "first-release-date": "2009-01-01", "artist-credit": [{ name: "Someone Else" }] },
      ] });
    }
    return jsonResponse({ results: [
      { trackName: "Cuz My Gear (Karaoke Version)", artistName: "Karaoke Kings", collectionName: "Hits", releaseDate: "2010-01-01T00:00:00Z" },
      // Same title, same credited artist, but a sound-alike release: only the karaoke filter catches it.
      { trackName: "Cuz My Gear (In the Style of Chief Keef)", artistName: "Chief Keef", collectionName: "Karaoke Hits, Vol. 3", releaseDate: "2009-06-01T00:00:00Z" },
    ] });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/submit validation", () => {
  it("refuses a bad month: malformed, before the Hot 100, or in the future", async () => {
    for (const month of ["2012-5", "2012-13", "1958-07", "2999-01", "", "May 2012"]) {
      const res = await POST(req({ ...good, month }));
      expect(res.status, month).toBe(400);
      expect((await res.json()).field).toBe("month");
    }
    expect(convex.mutation).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honeypot filled: 200, looks like success, stores nothing and calls nobody", async () => {
    const res = await POST(req({ ...good, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, verdict: "unverified" });
    expect(convex.query).not.toHaveBeenCalled();
    expect(convex.mutation).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses oversize fields", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...good, song: "x".repeat(121) }, "song"],
      [{ ...good, artist: "y".repeat(121) }, "artist"],
      [{ ...good, note: "z".repeat(281) }, "note"],
      [{ ...good, song: "" }, "song"],
      [{ ...good, song: "\u0000\u0007​" }, "song"], // only control characters: empty after cleaning
    ];
    for (const [body, field] of cases) {
      const res = await POST(req(body));
      expect(res.status, field).toBe(400);
      expect((await res.json()).field).toBe(field);
    }
    const huge = await POST(req({ ...good, note: "n".repeat(5000) }));
    expect(huge.status).toBe(413);
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it("refuses a link that is not https on an allowed music host", async () => {
    for (const link of [
      "http://www.youtube.com/watch?v=nB9au3UBSqI",      // not https
      "https://evil.example/youtube.com",                 // wrong host
      "https://youtube.com.evil.example/watch",           // suffix trick
      "https://user:pw@youtube.com/watch",                 // credentials
      "javascript:alert(1)",
      "https://open.spotify.com.evil.example/track/1",
      "https://notspotify.com/track/1",
    ]) {
      const res = await POST(req({ ...good, link }));
      expect(res.status, link).toBe(400);
      expect((await res.json()).field).toBe("link");
    }
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it("refuses non-JSON and malformed JSON", async () => {
    expect((await POST(req(good, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(req("{not json"))).status).toBe(400);
    expect((await POST(req([1, 2]))).status).toBe(400);
  });
});

describe("POST /api/submit storing", () => {
  it("fact-checks, stores pending evidence, and answers with the verdict only", async () => {
    indexRow.mockReturnValue({ s: "Cuz My Gear", a: "Chief Keef & Riff Raff", d: "2012-04-28", g: "day", src: "seed", ds: "uploaded to YouTube", k: "cuzmygear|chiefkeef" });
    const res = await POST(req({ ...good, note: "  every\nparty  ", link: "https://youtu.be/nB9au3UBSqI", website: "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, verdict: "consistent" }); // no evidence echoed

    expect(fetchMock).toHaveBeenCalledTimes(2); // one MusicBrainz call, one iTunes call
    const mbCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith("https://musicbrainz.org/"))!;
    expect((mbCall[1] as RequestInit).headers).toMatchObject({ "User-Agent": "MusicTimeMachine/2.0 (dev@jamesdare.com)" });

    const args = convex.mutation.mock.calls[0][1];
    expect(args.secret).toBe("s".repeat(64));
    expect(args.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(args.ipHash).not.toContain("203.0.113.7");
    expect(args.note).toBe("every party");
    expect(args.link).toBe("https://youtu.be/nB9au3UBSqI");
    // Other-artist MB row (2009) and the karaoke iTunes row are both ignored.
    expect(args.evidence).toEqual({
      known: [
        { source: "index", date: "2012-04-28", label: "uploaded to YouTube" },
        { source: "musicbrainz", date: "2012-05-17", label: "first release (MusicBrainz)" },
      ],
      earliest: "2012-04-28",
      verdict: "consistent",
    });
  });

  it("429 once a hash has 5 submissions in the hour, before any outbound call", async () => {
    convex.query.mockResolvedValue(5);
    const res = await POST(req(good));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it("429 when the transaction's own re-count refuses (a racing burst)", async () => {
    convex.mutation.mockResolvedValue({ ok: false, reason: "rate" });
    expect((await POST(req(good))).status).toBe(429);
  });

  it("unverified when every source fails, and still stores it", async () => {
    fetchMock.mockImplementation(async () => new Response("busy", { status: 503 }));
    const res = await POST(req(good));
    expect(await res.json()).toEqual({ ok: true, verdict: "unverified" });
    expect(convex.mutation.mock.calls[0][1].evidence).toEqual({ known: [], verdict: "unverified" });
  });

  it("503 when storage is not configured, 502 when Convex throws", async () => {
    delete process.env.CONVEX_SERVER_SECRET;
    expect((await POST(req(good))).status).toBe(503);
    process.env.CONVEX_SERVER_SECRET = "s".repeat(64);
    convex.query.mockRejectedValue(new Error("network"));
    expect((await POST(req(good))).status).toBe(502);
  });
});

describe("validate helpers", () => {
  it("allowedLink accepts the music hosts and their subdomains where expected", () => {
    expect(allowedLink("https://www.youtube.com/watch?v=nB9au3UBSqI")).toBeTruthy();
    expect(allowedLink("https://m.youtube.com/watch?v=x")).toBeTruthy();
    expect(allowedLink("https://soundcloud.com/a/b")).toBeTruthy();
    expect(allowedLink("https://artist.bandcamp.com/track/x")).toBeTruthy();
    expect(allowedLink("https://music.apple.com/us/album/x/1")).toBeTruthy();
    expect(allowedLink("https://audiomack.com/a/song/b")).toBeTruthy();
    expect(allowedLink("https://open.spotify.com/track/1")).toBeTruthy();
    expect(allowedLink("https://spotify.com/track/1")).toBeNull();
    expect(allowedLink("https://youtube.com:8443/x")).toBeNull();
  });

  it("cleanText strips control and bidi characters", () => {
    expect(cleanText("Cuz\u0000 My‮ Gear\t\n")).toBe("Cuz My Gear");
  });

  it("checkSubmission keeps optional fields out when empty", () => {
    const r = checkSubmission({ ...good, note: "", link: "  " }, new Date("2026-10-20T12:00:00Z"));
    expect(r).toEqual({ kind: "ok", value: { song: "Cuz My Gear", artist: "Chief Keef", month: "2012-05" } });
    expect(checkSubmission({ ...good, month: "2026-10" }, new Date("2026-10-20T12:00:00Z")).kind).toBe("ok");
    expect(checkSubmission({ ...good, month: "2026-11" }, new Date("2026-10-20T12:00:00Z")).kind).toBe("invalid");
  });
});
