// @vitest-environment node
// Runs the era page's server function for real song cases. Type checks cannot see a const used before
// its declaration inside a closure; on 2026-10-20 that shipped as a 500 for any song in the week's top 10.
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/coverArt", () => ({ coverArtFor: async () => null }));
vi.mock("@/lib/era/remembered", () => ({ rememberedFor: async () => [] }));

const { default: EraPage, generateMetadata } = await import("../page");

const run = (month: string, q: Record<string, string> = {}) =>
  EraPage({ params: Promise.resolve({ month }), searchParams: Promise.resolve(q) });

describe("era page renders for", () => {
  it.each([
    ["a song in that week's top 10", "2011-06", { song: "Rolling In The Deep", artist: "Adele", date: "2011-06-15", sd: "2010-11-29", ds: "released (iTunes)" }],
    ["the week's #1 itself", "2012-04", { song: "Somebody That I Used To Know", artist: "Gotye", date: "2012-04-28" }],
    ["a YouTube-only song", "2012-04", { song: "Cuz My Gear", artist: "Chief Keef & Riff Raff", date: "2012-04-28" }],
    ["a song the index has never seen", "1999-07", { song: "Not A Real Song Xyz", artist: "Nobody", date: "1999-07-10" }],
    ["no song at all", "1985-03", {}],
    ["the newest month", "2026-10", {}],
    ["a birthday", "1990-03", { born: "1", date: "1990-03-14" }],
  ])("%s", async (_label, month, q) => {
    const el = await run(month, q as Record<string, string>);
    expect(el).toBeTruthy();
    const meta = await generateMetadata({ params: Promise.resolve({ month }), searchParams: Promise.resolve(q as Record<string, string>) });
    expect(String(meta.title)).toContain("Was Playing");
  });

  it("refuses months outside the charts", async () => {
    await expect(run("1950-01")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(run("2012-13")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
