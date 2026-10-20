// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const convex = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function () { return convex; }),
}));

beforeEach(() => {
  vi.resetModules(); // fresh per-month cache each test
  convex.query.mockReset();
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example-test.convex.cloud";
});

async function load() {
  return (await import("../remembered")).rememberedFor;
}

describe("rememberedFor", () => {
  it("[] when NEXT_PUBLIC_CONVEX_URL is unset, without calling Convex", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    expect(await (await load())("2012-05")).toEqual([]);
    expect(convex.query).not.toHaveBeenCalled();
  });

  it("[] on a bad month or any Convex error", async () => {
    const rememberedFor = await load();
    expect(await rememberedFor("2012-5")).toEqual([]);
    convex.query.mockRejectedValue(new Error("down"));
    expect(await rememberedFor("2012-05")).toEqual([]);
  });

  it("returns public fields, drops a link that fails the host check, caps at 20", async () => {
    const row = { song: "Cuz My Gear", artist: "Chief Keef", verdict: "consistent", earliest: "2012-04-28", link: "https://youtu.be/nB9au3UBSqI" };
    convex.query.mockResolvedValue([{ ...row, link: "javascript:alert(1)" }, ...Array.from({ length: 30 }, () => row)]);
    const out = await (await load())("2012-05");
    expect(out).toHaveLength(20);
    expect(out[0]).toEqual({ song: "Cuz My Gear", artist: "Chief Keef", verdict: "consistent", earliest: "2012-04-28" });
    expect(out[1].link).toBe("https://youtu.be/nB9au3UBSqI");
  });
});
