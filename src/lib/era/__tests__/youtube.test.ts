import { describe, it, expect } from "vitest";
import { channelArtist, decodeEntities, mapYouTubeSearch, parseVideoTitle } from "@/lib/era/youtube";

// Titles in the shapes search.list returned on 2026-10-20 for "casper dopeboy" and "pressa novacane".
const item = (videoId: string, title: string, channelTitle: string, publishedAt: string, live = "none") => ({
  id: { kind: "youtube#video", videoId },
  snippet: { title, channelTitle, publishedAt: `${publishedAt}T05:00:00Z`, liveBroadcastContent: live },
});

describe("parseVideoTitle", () => {
  it("reads the house format and drops the upload's decorations", () => {
    expect(parseVideoTitle("Casper TNG Ft Fresh - Dope Boy (Official Video) [Ghost Town Vol 2]", "6ixBuzz Premieres"))
      .toEqual({ song: "Dope Boy [Ghost Town Vol 2]", artist: "Casper TNG feat. Fresh" });
    expect(parseVideoTitle("Chief Keef - I Don&#39;t Like f. Lil Reese | Shot By @DGainz", "DGainz"))
      .toEqual({ song: "I Don't Like", artist: "Chief Keef feat. Lil Reese" });
  });
  it("reads WorldStar's quoted titles, with the feature after the quote", () => {
    expect(parseVideoTitle("Murda Beatz &quot;Novacane&quot; Feat. Pressa (WSHH Exclusive - Official Music Video)", "WORLDSTARHIPHOP"))
      .toEqual({ song: "Novacane", artist: "Murda Beatz feat. Pressa" });
  });
  it("keeps a version tail and drops an album tail", () => {
    expect(parseVideoTitle("Casper TNG - Dope Boy - Dope Boy The Album", "Casper TNG ARCHIVE")).toEqual({ song: "Dope Boy", artist: "Casper TNG" });
    expect(parseVideoTitle("Drake - Hotline Bling - Remix", "x")).toEqual({ song: "Hotline Bling (Remix)", artist: "Drake" });
  });
  it("drops an unbracketed decoration at the end, never a title word", () => {
    expect(parseVideoTitle("Section Boyz - Lock Arff Official Video", "x")).toEqual({ song: "Lock Arff", artist: "Section Boyz" });
    expect(parseVideoTitle("Drake - Hotline Bling Music Video", "x")).toEqual({ song: "Hotline Bling", artist: "Drake" });
    expect(parseVideoTitle("The Buggles - Video Killed the Radio Star", "x")).toEqual({ song: "Video Killed the Radio Star", artist: "The Buggles" });
  });
  it("credits a bare title to the channel, minus VEVO", () => {
    expect(parseVideoTitle("Dope Boy", "CasperTNGVEVO")).toEqual({ song: "Dope Boy", artist: "CasperTNG" });
  });
  it("drops reactions, beats, pitch edits and full tapes", () => {
    for (const t of [
      "Casper TNG ft Fresh - Dope Boy (Official Reaction)",
      "Casper TNG Ft Fresh - Dope Boy (Official Video) | American Reaction",
      "Casper TNG - Dopeboy (432Hz)",
      "Chief Keef Type Beat - Sosa",
      "Chief Keef - Back From The Dead (Full Mixtape)",
    ]) expect(parseVideoTitle(t, "someone")).toBeNull();
  });
});

describe("decodeEntities / channelArtist", () => {
  it("decodes what the API escapes", () => {
    expect(decodeEntities("Murda Beatz &amp; Pressa Perform &#39;Novacane&#39; &#x2665;")).toBe("Murda Beatz & Pressa Perform 'Novacane' ♥");
    expect(decodeEntities("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
  it("strips channel noise", () => {
    expect(channelArtist("ChiefKeefVEVO")).toBe("ChiefKeef");
    expect(channelArtist("Pressa - Topic")).toBe("Pressa");
  });
});

describe("mapYouTubeSearch", () => {
  const json = {
    items: [
      item("aaaaaaaaaa1", "Casper TNG ft Fresh - Dope Boy", "BigJo.O", "2021-08-09"),
      item("E7ZStZMn-ac", "Casper TNG Ft Fresh - Dope Boy (Official Video) [Ghost Town Vol 2]", "6ixBuzz Premieres", "2015-02-10"),
      item("aaaaaaaaaa2", "Novacane", "Pressa - Topic", "2025-06-04"),
      item("aaaaaaaaaa3", "Casper TNG ft Fresh - Dope Boy (Official Reaction)", "ImCaliKid", "2020-12-28"),
      item("aaaaaaaaaa4", "Casper live now - Dope Boy", "x", "2026-01-01", "live"),
      item("bad id", "Casper TNG - Dope Boy", "x", "2015-01-01"),
      { id: { kind: "youtube#channel", channelId: "UC123" }, snippet: { title: "Casper TNG" } },
    ],
  };
  it("puts the official upload first, drops Topic mirrors, reactions, streams and malformed items", () => {
    const rows = mapYouTubeSearch(json);
    expect(rows.map((r) => r.youtubeId)).toEqual(["E7ZStZMn-ac", "aaaaaaaaaa1"]);
    expect(rows[0]).toMatchObject({
      song: "Dope Boy [Ghost Town Vol 2]", artist: "Casper TNG feat. Fresh", date: "2015-02-10", granularity: "day",
      dateSource: "uploaded to YouTube", where: ["youtube"], onDsp: null,
    });
  });
  it("is empty for anything that is not a search response", () => {
    expect(mapYouTubeSearch(null)).toEqual([]);
    expect(mapYouTubeSearch({ error: { code: 403 } })).toEqual([]);
  });
});
