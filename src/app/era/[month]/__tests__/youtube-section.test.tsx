// @vitest-environment node
// The "Where it broke" section, rendered to HTML with a fixture month: the crawl's files are not in the repo yet,
// and the section must render, rank channels and answer the verdict before they are.
import { describe, it, expect, vi } from "vitest";
import { prerender } from "react-dom/static";
import type { YouTubeMonth } from "@/lib/era/data";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ push() {}, prefetch() {} }) }));
vi.mock("@/lib/coverArt", () => ({ coverArtFor: async () => null }));
vi.mock("@/lib/era/remembered", () => ({ rememberedFor: async () => [] }));

const row = (rank: number, song: string, artist: string, views: number, videoId: string) =>
  ({ rank, song, artist, title: `${artist} - ${song}`, videoId, published: "2015-02-10", views });
const FIXTURE: YouTubeMonth = {
  month: "2015-02",
  viewsAsOf: "2026-10-20",
  sources: [
    { id: "yt:@grmdaily", label: "GRM Daily", genre: "uk", channel: "https://www.youtube.com/@grmdaily", rows: [row(1, "Shutdown", "Skepta", 900_000, "aaaaaaaaaa1")] },
    { id: "yt:@6ixbuzzpremieres", label: "6ixBuzz Premieres", genre: "hip-hop", channel: "https://www.youtube.com/@6ixbuzzpremieres",
      rows: [row(1, "Dope Boy", "Casper TNG Ft Fresh", 5_410_000, "E7ZStZMn-ac"), row(2, "Other", "Someone", 10_000, "aaaaaaaaaa2")] },
  ],
};
vi.mock("@/lib/era/data", async (orig) => {
  const real = await orig<typeof import("@/lib/era/data")>();
  return { ...real, youtubeFor: (m: string) => (m === "2015-02" ? FIXTURE : null) };
});

const { default: EraPage } = await import("../page");
// prerender waits for the page's async children (Remembered) where renderToStaticMarkup cannot.
const html = async (month: string, q: Record<string, string> = {}) => {
  const { prelude } = await prerender(await EraPage({ params: Promise.resolve({ month }), searchParams: Promise.resolve(q) }));
  return (await new Response(prelude).text()).replaceAll("<!-- -->", ""); // React's text separators
};

describe("Where it broke", () => {
  it("renders the month's channels, the loudest first, with views, dates and links", async () => {
    const out = await html("2015-02");
    expect(out).toContain("Where it broke");
    expect(out.indexOf("6ixBuzz Premieres")).toBeLessThan(out.indexOf("GRM Daily"));
    expect(out).toContain("5.4M views");
    expect(out).toContain("https://www.youtube.com/watch?v=E7ZStZMn-ac");
    expect(out).toContain("views counted 20 OCT 2026");
  });
  it("answers the verdict for a song uploaded that month", async () => {
    const out = await html("2015-02", { song: "Dope Boy", artist: "Casper TNG & Fresh", date: "2015-02-10" });
    expect(out).toContain("Uploaded by 6ixBuzz Premieres that month: 5.4M views since.");
  });
  it("is absent for a month with no crawl", async () => {
    expect(await html("2012-04")).not.toContain("Where it broke");
  });
});
