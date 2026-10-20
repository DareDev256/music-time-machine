import { describe, it, expect, vi, afterEach } from "vitest";
import type { DatedSong, ResolveOutcome } from "@/lib/era/types";
import {
  resolveQuery,
  browserDeps,
  buildMbQuery,
  mapMusicBrainz,
  mapItunes,
  mergeSong,
  indexRowToDatedSong,
  type ResolverDeps,
} from "@/lib/era/resolve";
import { flightTarget } from "@/lib/era/dates";

// ── fixtures: rows exactly as each dependency hands them over ────────────────
const chart = (song: string, artist: string, date: string): DatedSong => ({
  song, artist, date, granularity: "day", dateSource: "entered the Hot 100", where: ["chart"], onDsp: null,
});
const seed = (song: string, artist: string, date: string, dateSource = "uploaded to YouTube"): DatedSong => ({
  song, artist, date, granularity: "day", dateSource, where: ["seed", "youtube"], onDsp: false,
});
const mb = (song: string, artist: string, date: string, granularity: DatedSong["granularity"] = "day", isrc?: string): DatedSong => ({
  song, artist, date, granularity, dateSource: "first release (MusicBrainz)", where: ["musicbrainz"], onDsp: null,
  mbid: `mbid-${song}-${artist}-${date}`, ...(isrc ? { isrc } : {}),
});
const it_ = (song: string, artist: string, date: string): DatedSong => ({
  song, artist, date, granularity: "day", dateSource: "released (iTunes)", where: ["itunes"], onDsp: true,
  art: `https://is1-ssl.mzstatic.com/image/thumb/${encodeURIComponent(artist)}/{w}x{h}bb.jpg`,
  previewUrl: `https://audio-ssl.itunes.apple.com/${encodeURIComponent(song)}.m4a`,
});

type Rows = DatedSong[] | (() => never);
function fakeDeps(opts: { index?: Rows; mb?: Rows; itunes?: Rows } = {}) {
  const run = (r: Rows | undefined) => async () => {
    if (typeof r === "function") r();
    return (r as DatedSong[] | undefined) ?? [];
  };
  const deps = {
    indexSearch: vi.fn(run(opts.index)),
    musicbrainz: vi.fn(run(opts.mb)),
    itunes: vi.fn(run(opts.itunes)),
  };
  return deps satisfies ResolverDeps;
}
const boom = (): never => {
  throw new Error("network down");
};

function asSong(o: ResolveOutcome) {
  if (o.kind !== "song") throw new Error(`expected a song, got ${JSON.stringify(o)}`);
  return o;
}

// ── §12.10: a 4-digit token is a year only if the rest still resolves ─────────
describe("titles that look like years", () => {
  it('"1999" with the index holding 1999 — Prince resolves as the song, not the year', async () => {
    const deps = fakeDeps({ index: [chart("1999", "Prince", "1982-11-06")] });
    const out = asSong(await resolveQuery("1999", deps));
    expect(out.best.song).toBe("1999");
    expect(out.best.artist).toBe("Prince");
  });

  it('a bare year that is a charted title is the song, flagged so the caller can offer the year too', async () => {
    const out = asSong(await resolveQuery("1999", fakeDeps({ index: [chart("1999", "Prince", "1982-11-06")] })));
    expect(out.needsPick).toBe(true);
  });

  it('"2012" is not swallowed by "2012 (It Ain\'t The End)": a bare year must equal the whole title', async () => {
    const deps = fakeDeps({ index: [chart("2012 (It Ain't The End)", "Jay Sean Featuring Nicki Minaj", "2010-08-21")] });
    expect(await resolveQuery("2012", deps)).toMatchObject({ kind: "date", date: "2012-06-15" });
  });

  it('"1999" with an empty index and no MusicBrainz hit is the year 1999', async () => {
    const out = await resolveQuery("1999", fakeDeps());
    expect(out).toMatchObject({ kind: "date", date: "1999-06-15", granularity: "year" });
  });

  it("a bare year never becomes a MusicBrainz-only song", async () => {
    const deps = fakeDeps({ mb: [mb("2012", "Some Band", "2011-03-01"), mb("2012", "Another Act", "2010-01-01")] });
    const out = await resolveQuery("2012", deps);
    expect(out).toMatchObject({ kind: "date", date: "2012-06-15", granularity: "year" });
  });

  it('"7 Years" resolves as a song', async () => {
    const deps = fakeDeps({ index: [chart("7 Years", "Lukas Graham", "2016-01-23")] });
    expect(asSong(await resolveQuery("7 Years", deps)).best.song).toBe("7 Years");
  });

  it('"7 years" with nothing found is not a date', async () => {
    const out = await resolveQuery("7 years", fakeDeps());
    expect(out.kind).toBe("none");
  });

  it(`"Summer of '69" resolves as the Bryan Adams song`, async () => {
    const deps = fakeDeps({ index: [chart("Summer Of '69", "Bryan Adams", "1985-06-15")] });
    const out = asSong(await resolveQuery("Summer of '69", deps));
    expect(out.best.artist).toBe("Bryan Adams");
    expect(out.needsPick).toBeFalsy();
  });

  it(`"summer of '69" with nothing in the index flies to summer 1969`, async () => {
    const out = await resolveQuery("summer of '69", fakeDeps());
    expect(out).toMatchObject({ kind: "date", date: "1969-07-15", granularity: "month" });
  });

  it('"2002" resolves as a song when the index holds it', async () => {
    const deps = fakeDeps({ index: [chart("2002", "Anne-Marie", "2018-05-05")] });
    expect(asSong(await resolveQuery("2002", deps)).best.artist).toBe("Anne-Marie");
  });

  it('"1999 prince" and "prince 1999" both resolve as the song', async () => {
    const index = [chart("1999", "Prince", "1982-11-06"), chart("Purple Rain", "Prince", "1984-10-06")];
    expect(asSong(await resolveQuery("1999 prince", fakeDeps({ index }))).best.song).toBe("1999");
    expect(asSong(await resolveQuery("prince 1999", fakeDeps({ index }))).best.song).toBe("1999");
  });

  it('a month that is also a title ("March") does not swallow "March 2012"', async () => {
    const deps = fakeDeps({ index: [chart("March", "Some Artist", "2012-03-10")] });
    expect(await resolveQuery("March 2012", deps)).toMatchObject({ kind: "date", date: "2012-03-15" });
  });
});

// ── §12.10: iTunes counts only on a primary-artist match; karaoke is discarded ──
describe("iTunes guards", () => {
  it('a karaoke row for "Shut Up" is discarded', async () => {
    const deps = fakeDeps({
      mb: [mb("Shut Up", "Stormzy", "2016-02-16")],
      itunes: [it_("Shut Up (Originally Performed by Stormzy) [Karaoke Version]", "Karaoke Hits Band", "2015-12-16")],
    });
    const out = asSong(await resolveQuery("shut up stormzy", deps));
    expect(out.best.date).toBe("2016-02-16");
    expect(out.best.where).not.toContain("itunes");
    expect(out.best.onDsp).not.toBe(true);
    expect(out.best.art).toBeUndefined();
  });

  it("MusicBrainz 2016-02-16 vs the seed's YouTube 2015-05-17 → 2015-05-17, uploaded to YouTube", async () => {
    // "shut up" alone is ambiguous in the index (Stormzy seed + Black Eyed Peas chart row),
    // so MusicBrainz and iTunes are consulted and merged into the Stormzy candidate.
    const deps = fakeDeps({
      index: [seed("Shut Up", "Stormzy", "2015-05-17"), chart("Shut Up", "The Black Eyed Peas", "2003-11-29")],
      mb: [mb("Shut Up", "Stormzy", "2016-02-16"), mb("Shut Up", "Stormzy", "2017-05-23", "day", "UKJ4A1700032")],
      itunes: [it_("Shut Up", "Karaoke Hits Band", "2015-12-16")],
    });
    const out = asSong(await resolveQuery("shut up", deps));
    const stormzy = out.candidates.find((c) => c.artist === "Stormzy")!;
    expect(stormzy.date).toBe("2015-05-17");
    expect(stormzy.dateSource).toBe("uploaded to YouTube");
    expect(stormzy.where).toEqual(expect.arrayContaining(["seed", "youtube", "musicbrainz"]));
    expect(stormzy.where).not.toContain("itunes");
    expect(stormzy.isrc).toBe("UKJ4A1700032");
    expect(out.needsPick).toBe(true);
    expect(deps.musicbrainz).toHaveBeenCalledTimes(1);
  });

  it("an iTunes row joins the song only when its primary artist matches", async () => {
    const deps = fakeDeps({
      mb: [mb("Rolling in the Deep", "Adele", "2010-10-21")],
      itunes: [
        it_("Rolling in the Deep", "Linkin Park", "2011-06-01"),
        it_("Rolling in the Deep", "Adele", "2010-11-29"),
      ],
    });
    const out = asSong(await resolveQuery("adele rolling in the deep", deps));
    expect(out.best.onDsp).toBe(true);
    expect(out.best.art).toContain("Adele");
    expect(out.best.art).not.toContain("Linkin");
    expect(out.best.previewUrl).toContain("Rolling");
    expect(out.best.date).toBe("2010-10-21");
  });

  it.each(["Made Famous by Adele", "Adele Tribute Band", "In the Style of Adele", "The Karaoke Channel"])(
    'discards the iTunes artist "%s"',
    async (artist) => {
      const deps = fakeDeps({
        mb: [mb("Rolling in the Deep", "Adele", "2010-10-21")],
        itunes: [it_("Rolling in the Deep", artist, "2009-01-01")],
      });
      const out = asSong(await resolveQuery("adele rolling in the deep", deps));
      expect(out.best.date).toBe("2010-10-21");
      expect(out.best.where).not.toContain("itunes");
    },
  );

  it("an iTunes title marked karaoke is discarded even under the real artist's name", async () => {
    const deps = fakeDeps({
      mb: [mb("Rolling in the Deep", "Adele", "2010-10-21")],
      itunes: [it_("Rolling in the Deep (Karaoke Version)", "Adele", "2009-01-01")],
    });
    const out = asSong(await resolveQuery("adele rolling in the deep", deps));
    expect(out.best.where).not.toContain("itunes");
  });

  it("an iTunes-only hit counts when the query names its artist", async () => {
    const deps = fakeDeps({ mb: boom, itunes: [it_("Rolling in the Deep", "Adele", "2010-11-29")] });
    const out = asSong(await resolveQuery("adele rolling in the deep", deps));
    expect(out.best).toMatchObject({ date: "2010-11-29", onDsp: true, where: ["itunes"] });
  });

  it("an iTunes-only hit with no artist to check it against does not count", async () => {
    const deps = fakeDeps({ itunes: [it_("Rolling in the Deep", "Adele", "2010-11-29")] });
    expect((await resolveQuery("rolling in the deep", deps)).kind).toBe("none");
  });

  it("an iTunes miss is not proof of absence: onDsp stays null", async () => {
    // Measured: iTunes search for "Nikes Frank Ocean" omits Nikes, which is on Apple Music.
    const deps = fakeDeps({
      index: [chart("Nikes", "Frank Ocean", "2016-09-10")],
      itunes: [it_("White Ferrari", "Frank Ocean", "2016-08-20"), it_("Nikes", "Blond Piano", "2017-03-19")],
    });
    expect(asSong(await resolveQuery("frank ocean nikes", deps)).best.onDsp).toBeNull();
  });

  it("only a verified row can say not on a DSP", async () => {
    const deps = fakeDeps({ index: [{ ...seed("Cuz My Gear", "Chief Keef & Riff Raff", "2012-04-28"), onDsp: false }] });
    expect(asSong(await resolveQuery("cuz my gear", deps)).best.onDsp).toBe(false);
  });

  it("a MusicBrainz 'artist' named exactly like the song is not an artist match", async () => {
    const deps = fakeDeps({
      index: [
        chart("Somebody That I Used To Know (feat. Kimbra)", "Gotye", "2011-07-15"),
        chart("Somebody That I Used To Know", "Christina Grimmie & Adam Levine", "2014-06-07"),
      ],
      mb: [mb("Somebody That I Used to Know", "Somebody That I Used to Know", "2017-01-12")],
      itunes: [it_("Somebody That I Used to Know", "Gotye", "2011-07-05")],
    });
    const out = asSong(await resolveQuery("somebody that i used to know", deps));
    expect(out.best.artist).toBe("Gotye");
    expect(out.candidates.map((c) => c.artist)).not.toContain("Somebody That I Used to Know");
    // iTunes alone is one source, not two: still a pick.
    expect(out.needsPick).toBe(true);
  });

  it("a self-titled song is not an artist match for its title alone", async () => {
    const index = [chart("Bad Company", "Bad Company", "1975-01-11"), chart("Bad Company", "Five Finger Death Punch", "2010-02-27")];
    expect(asSong(await resolveQuery("bad company", fakeDeps({ index }))).needsPick).toBe(true);
    const named = asSong(await resolveQuery("bad company five finger death punch", fakeDeps({ index })));
    expect(named.best.artist).toBe("Five Finger Death Punch");
    expect(named.needsPick).toBeFalsy();
  });

  it("a song only a cast recorded is accepted", async () => {
    const deps = fakeDeps({ index: [chart("Loser Like Me", "Glee Cast", "2011-03-26")] });
    const out = asSong(await resolveQuery("loser like me", deps));
    expect(out.best.artist).toBe("Glee Cast");
    expect(out.needsPick).toBeFalsy();
  });

  it("iTunes is searched with the title's own small words", async () => {
    const deps = fakeDeps();
    await resolveQuery("somebody that i used to know", deps);
    expect(deps.itunes).toHaveBeenCalledWith("somebody that i used to know");
  });

  it("an iTunes 1 Jan release date is year-only and loses to a real date in that year", async () => {
    const rows = mapItunes({ results: [{ kind: "song", trackName: "1999", artistName: "Prince", releaseDate: "1982-01-01T08:00:00Z" }] });
    expect(rows[0]).toMatchObject({ date: "1982-06-15", granularity: "year" });
    const deps = fakeDeps({ index: [chart("1999", "Prince", "1982-10-30")], itunes: rows });
    expect(asSong(await resolveQuery("1999", deps)).best).toMatchObject({ date: "1982-10-30", dateSource: "entered the Hot 100", onDsp: true });
  });

  it("the plainest title names the song when no chart row does", async () => {
    const deps = fakeDeps({ mb: boom, itunes: [it_("Shutdown (Preditah Remix)", "Skepta", "2015-05-01"), it_("Shutdown", "Skepta", "2015-04-26")] });
    expect(asSong(await resolveQuery("skepta shutdown", deps)).best).toMatchObject({ song: "Shutdown", date: "2015-04-26" });
  });

  it("onDsp is null when iTunes failed", async () => {
    const deps = fakeDeps({ mb: [mb("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-05-17")], itunes: boom });
    expect(asSong(await resolveQuery("chief keef cuz my gear", deps)).best.onDsp).toBeNull();
  });
});

// ── §12.10: partial MusicBrainz dates keep their granularity ──────────────────
describe("partial dates", () => {
  it('a MusicBrainz "2012" is year granularity and flies to mid-year', async () => {
    const deps = fakeDeps({ mb: [mb("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-06-15", "year")] });
    const out = asSong(await resolveQuery("chief keef cuz my gear", deps));
    expect(out.best.granularity).toBe("year");
    expect(flightTarget(out.best.date, out.best.granularity)).toBe("2012-06-15");
  });

  it("the MusicBrainz mapper keeps the granularity of first-release-date", () => {
    const rows = mapMusicBrainz({
      recordings: [
        { id: "a", title: "One", "first-release-date": "2012", "artist-credit": [{ name: "X" }] },
        { id: "b", title: "Two", "first-release-date": "2012-05", "artist-credit": [{ name: "X" }] },
        { id: "c", title: "Three", "first-release-date": "2012-05-17", "artist-credit": [{ name: "X" }] },
        { id: "d", title: "Undated", "artist-credit": [{ name: "X" }] },
      ],
    });
    expect(rows.map((r) => [r.song, r.date, r.granularity])).toEqual([
      ["One", "2012-06-15", "year"],
      ["Two", "2012-05-15", "month"],
      ["Three", "2012-05-17", "day"],
    ]);
  });

  it("a finer date inside a coarser period wins over the period's start", () => {
    const merged = mergeSong([mb("Us", "Lil Reese", "2012-06-15", "year"), seed("Us", "Lil Reese", "2012-04-04")]);
    expect(merged).toMatchObject({ date: "2012-04-04", granularity: "day", dateSource: "uploaded to YouTube" });
  });

  it("an earlier year-only date still beats a later day", () => {
    const merged = mergeSong([chart("X", "Y", "2013-03-02"), mb("X", "Y", "2011-06-15", "year")]);
    expect(merged).toMatchObject({ date: "2011-06-15", granularity: "year" });
  });
});

// ── §12.10: chart dates are "entered the Hot 100"; an earlier MB date overrides ──
describe("chart dates", () => {
  it('an index row from the Hot 100 is labelled "entered the Hot 100", never "released"', () => {
    const row = indexRowToDatedSong({ s: "Rolling in the Deep", a: "Adele", d: "2010-12-18", g: "day", src: "hot100", k: "x" });
    expect(row).toMatchObject({ dateSource: "entered the Hot 100", where: ["chart"], date: "2010-12-18", granularity: "day" });
    expect(row!.dateSource).not.toMatch(/releas/i);
  });

  it("an earlier MusicBrainz date overrides the chart date", async () => {
    const deps = fakeDeps({
      index: [chart("Rolling in the Deep", "Adele", "2010-12-18")],
      mb: [mb("Rolling in the Deep", "Adele", "2010-10-21", "day", "GBBKS1000335")],
      itunes: [it_("Rolling in the Deep", "Adele", "2010-11-29")],
    });
    const out = asSong(await resolveQuery("rolling in the deep", deps));
    expect(out.best).toMatchObject({ date: "2010-10-21", dateSource: "first release (MusicBrainz)", isrc: "GBBKS1000335", onDsp: true });
    expect(out.best.where).toEqual(["chart", "musicbrainz", "itunes"]);
    expect(out.needsPick).toBeFalsy();
  });

  it("a later MusicBrainz date leaves the chart date in place", async () => {
    const deps = fakeDeps({
      index: [chart("1999", "Prince", "1982-11-06")],
      mb: [mb("1999", "Prince", "1998-06-15", "year")],
    });
    const out = asSong(await resolveQuery("1999", deps));
    expect(out.best).toMatchObject({ date: "1982-11-06", dateSource: "entered the Hot 100" });
  });

  it("a same-titled song by someone else featuring the artist is a different song", async () => {
    const deps = fakeDeps({
      index: [chart("Alright", "Kendrick Lamar", "2015-07-18")],
      mb: [mb("Alright", "Big K.R.I.T. feat. Kendrick Lamar", "2014-06-15", "year"), mb("Alright", "Kendrick Lamar", "2015-03-15")],
    });
    const out = asSong(await resolveQuery("kendrick lamar alright", deps));
    expect(out.best).toMatchObject({ artist: "Kendrick Lamar", date: "2015-03-15" });
    expect(out.needsPick).toBeFalsy();
  });

  it("MusicBrainz rows for a different artist with the same title never override", async () => {
    const deps = fakeDeps({
      index: [chart("Rolling in the Deep", "Adele", "2010-12-18")],
      mb: [mb("Rolling in the Deep", "Aretha Franklin", "2014-10-20"), mb("Rolling in the Deep", "Someone Else", "1990-01-01")],
    });
    expect(asSong(await resolveQuery("rolling in the deep", deps)).best.date).toBe("2010-12-18");
  });

  it("lane and heat rows say where they were seen (the row's ds wins; these are the fallbacks)", () => {
    expect(indexRowToDatedSong({ s: "A", a: "B", d: "2012-05-12", g: "day", src: "lane:rap", k: "a|b" })?.dateSource).toBe(
      "#1 on Hot Rap Songs",
    );
    expect(
      indexRowToDatedSong({ s: "A", a: "B", d: "2012-05-02", g: "day", src: "heat:hotnewhiphop", k: "a|b" })?.dateSource,
    ).toBe("seen on HotNewHipHop (archived capture)");
    expect(
      indexRowToDatedSong({ s: "A", a: "B", d: "2012-05-12", g: "day", src: "lane:rap", k: "a|b", ds: "#1 on Hot Rap Songs (wk)" })
        ?.dateSource,
    ).toBe("#1 on Hot Rap Songs (wk)");
  });

  it("a Hot 100 row is always 'entered the Hot 100', whatever its ds says", () => {
    expect(
      indexRowToDatedSong({ s: "A", a: "B", d: "2012-05-12", g: "day", src: "hot100", k: "a|b", ds: "released 2012" })?.dateSource,
    ).toBe("entered the Hot 100");
  });

  it("a heat row at month granularity flies to mid-month", () => {
    expect(indexRowToDatedSong({ s: "A", a: "B", d: "2012-05-02", g: "month", src: "heat:hypem", k: "a|b" })).toMatchObject({
      date: "2012-05-15", granularity: "month",
    });
  });

  it("a seed row keeps its own dateSource; y is the YouTube id; optional w / dsp fill where and onDsp", () => {
    const row = indexRowToDatedSong({
      s: "Cuz My Gear", a: "Chief Keef & Riff Raff", d: "2012-04-28", g: "day", src: "seed", k: "cuzmygear|chiefkeef",
      ds: "uploaded to YouTube", y: "nB9au3UBSqI", w: ["youtube", "musicbrainz"], dsp: false,
    });
    expect(row).toMatchObject({
      dateSource: "uploaded to YouTube", where: ["seed", "youtube", "musicbrainz"], onDsp: false, youtubeId: "nB9au3UBSqI",
    });
    const bare = indexRowToDatedSong({
      s: "Us", a: "Lil Reese", d: "2012-04-04", g: "day", src: "seed", k: "us|lilreese", ds: "uploaded to YouTube", y: "JdV0mmHrfBM",
    });
    expect(bare).toMatchObject({ where: ["seed", "youtube"], onDsp: null, youtubeId: "JdV0mmHrfBM" });
  });

  it("an index row with a year granularity is padded to mid-year", () => {
    expect(indexRowToDatedSong({ s: "A", a: "B", d: "2012-01-01", g: "year", src: "hot100", k: "a|b" })?.date).toBe("2012-06-15");
  });

  it("a malformed index row is dropped", () => {
    expect(indexRowToDatedSong({ s: "", a: "B", d: "2012-01-01", g: "day", src: "hot100", k: "" })).toBeNull();
    expect(indexRowToDatedSong({ s: "A", a: "B", d: "yesterday", g: "day", src: "hot100", k: "" })).toBeNull();
  });
});

// ── §12.10: common titles never auto-accept a MusicBrainz-only match ──────────
describe("common titles", () => {
  const holdOns = [
    mb("Hold On", "Wilson Phillips", "1990-02-27"),
    mb("Hold On", "Neko Case", "2006-03-07"),
    mb("Hold On", "The Sadies", "2006-08-08"),
  ];

  it('"Hold On" with no artist and no year and 3 MusicBrainz matches → 3 candidates, needs a pick', async () => {
    const out = asSong(await resolveQuery("Hold On", fakeDeps({ mb: holdOns })));
    expect(out.candidates).toHaveLength(3);
    expect(out.needsPick).toBe(true);
    expect(out.best.where).toEqual(["musicbrainz"]);
    // An iTunes miss on a loose title search says nothing about a picker candidate's DSP status.
    expect(out.candidates.every((c) => c.onDsp === null)).toBe(true);
  });

  it("never offers more than 3 candidates", async () => {
    const many = [...holdOns, mb("Hold On", "Alabama Shakes", "2012-02-14"), mb("Hold On", "SG Lewis", "2019-01-01")];
    const out = asSong(await resolveQuery("hold on", fakeDeps({ mb: many })));
    expect(out.candidates).toHaveLength(3);
  });

  it("naming the artist settles it", async () => {
    const out = asSong(await resolveQuery("hold on wilson phillips", fakeDeps({ mb: holdOns })));
    expect(out.best.artist).toBe("Wilson Phillips");
    expect(out.needsPick).toBeFalsy();
  });

  it("a year that fits exactly one candidate settles it", async () => {
    const out = asSong(await resolveQuery("hold on 1990", fakeDeps({ mb: holdOns })));
    expect(out.best.artist).toBe("Wilson Phillips");
    expect(out.needsPick).toBeFalsy();
  });

  it("ambiguous input with a year falls back to that year", async () => {
    const deps = fakeDeps({ mb: [...holdOns, mb("Hold On", "En Vogue", "1990-03-20")] });
    expect(await resolveQuery("hold on 1990", deps)).toMatchObject({ kind: "date", date: "1990-06-15", granularity: "year" });
  });

  it("two index songs with the same title need a pick", async () => {
    const deps = fakeDeps({ index: [chart("Hold On", "Wilson Phillips", "1990-04-14"), chart("Hold On", "En Vogue", "1990-05-12")] });
    const out = asSong(await resolveQuery("hold on", deps));
    expect(out.needsPick).toBe(true);
    expect(out.candidates.map((c) => c.artist).sort()).toEqual(["En Vogue", "Wilson Phillips"]);
  });

  it("a charted cast cover does not force a pick against the original", async () => {
    const deps = fakeDeps({
      index: [chart("Rolling In The Deep", "Adele", "2010-12-25"), chart("Rolling In The Deep", "Glee Cast Featuring Jonathan Groff", "2011-05-28")],
    });
    const out = asSong(await resolveQuery("rolling in the deep", deps));
    expect(out.best.artist).toBe("Adele");
    expect(out.needsPick).toBeFalsy();
    expect(out.candidates.map((c) => c.artist)).toContain("Glee Cast Featuring Jonathan Groff");
  });

  it('a title that says it is someone\'s version ("The Aretha Version") is a cover too', async () => {
    const deps = fakeDeps({
      index: [
        chart("Rolling In The Deep", "Adele", "2010-12-25"),
        chart("Rolling In The Deep", "Glee Cast Featuring Jonathan Groff", "2011-05-28"),
        chart("Rolling in the Deep (The Aretha Version)", "Aretha Franklin", "2015-01-03"),
      ],
    });
    const out = asSong(await resolveQuery("rolling in the deep", deps));
    expect(out.best.artist).toBe("Adele");
    expect(out.needsPick).toBeFalsy();
  });

  it("a cast cover is never ranked above the song it covers", async () => {
    const deps = fakeDeps({
      index: [
        chart("Somebody That I Used To Know", "Glee Cast", "2012-04-28"),
        chart("Somebody That I Used To Know", "Christina Grimmie & Adam Levine", "2014-06-07"),
        chart("Somebody That I Used To Know (feat. Kimbra)", "Gotye", "2011-07-15"),
      ],
    });
    const out = asSong(await resolveQuery("somebody that i used to know", deps));
    expect(out.needsPick).toBe(true);
    expect(out.candidates[out.candidates.length - 1].artist).toBe("Glee Cast");
  });

  it("iTunes plus MusicBrainz backing exactly one of several index songs settles it", async () => {
    const deps = fakeDeps({
      index: [
        chart("Somebody That I Used To Know (feat. Kimbra)", "Gotye", "2011-07-15"),
        chart("Somebody That I Used To Know", "Christina Grimmie & Adam Levine", "2014-06-07"),
      ],
      mb: [mb("Somebody That I Used to Know", "Gotye feat. Kimbra", "2011-07-05"), mb("Somebody That I Used to Know", "Gotye feat. Kimbra", "2011-08-19")],
      itunes: [it_("Somebody That I Used To Know (feat. Kimbra)", "Gotye", "2011-07-05")],
    });
    const out = asSong(await resolveQuery("somebody that i used to know", deps));
    expect(out.needsPick).toBeFalsy();
    expect(out.best).toMatchObject({ artist: "Gotye", date: "2011-07-05", onDsp: true });
  });

  it("MusicBrainz backing alone never settles a common title", async () => {
    const deps = fakeDeps({
      index: [chart("Hold On", "Wilson Phillips", "1990-04-14"), chart("Hold On", "En Vogue", "1990-05-12")],
      mb: [mb("Hold On", "Wilson Phillips", "1990-02-27"), mb("Hold On", "Wilson Phillips", "1991-01-01"), mb("Hold On", "Wilson Phillips", "1992-01-01")],
    });
    expect(asSong(await resolveQuery("hold on", deps)).needsPick).toBe(true);
  });

  it("a title only one artist has is accepted", async () => {
    const deps = fakeDeps({ mb: [mb("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-05-17"), mb("Cuz My Gear", "RiFF RAFF feat. Chief Keef", "2012-06-29")] });
    const out = asSong(await resolveQuery("cuz my gear", deps));
    expect(out.needsPick).toBeFalsy();
    expect(out.best.date).toBe("2012-05-17");
    expect(out.candidates).toHaveLength(1);
  });
});

// ── §12.10: the seeded non-DSP set needs zero external calls ──────────────────
describe("the seed", () => {
  const cuz = seed("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-04-28");

  it('"cuz my gear" resolves from the seed alone with zero MusicBrainz / iTunes calls', async () => {
    const deps = fakeDeps({ index: [cuz] });
    const out = asSong(await resolveQuery("cuz my gear", deps));
    expect(out.best).toMatchObject({ song: "Cuz My Gear", date: "2012-04-28", dateSource: "uploaded to YouTube", onDsp: false });
    expect(deps.musicbrainz).not.toHaveBeenCalled();
    expect(deps.itunes).not.toHaveBeenCalled();
  });

  it.each([
    "Cuz My Gear",
    "chief keef cuz my gear 2012",
    "chief keef my gear 2012",
    "I was listening to Chief Keef, Cuz My Gear, in 2012",
    "cuz my gear by chief keef",
    "Chief Keef - Cuz My Gear",
  ])('"%s" lands on the seed with no external calls', async (q) => {
    const deps = fakeDeps({ index: [cuz] });
    const out = asSong(await resolveQuery(q, deps));
    expect(out.best.date).toBe("2012-04-28");
    expect(deps.musicbrainz).not.toHaveBeenCalled();
    expect(deps.itunes).not.toHaveBeenCalled();
  });
});

// ── YouTube / seed dates are credible within 12 months of another source ─────
describe("earliest credible date", () => {
  it("a YouTube date within 12 months of another source wins when earlier", () => {
    expect(mergeSong([mb("Sweet Shop", "Doctor P", "2010-03-16"), seed("Sweet Shop", "Doctor P", "2009-11-06")]).date).toBe(
      "2009-11-06",
    );
  });

  it("a YouTube date more than 12 months before every other source is not credible", () => {
    const merged = mergeSong([mb("Sweet Shop", "Doctor P", "2010-03-16"), seed("Sweet Shop", "Doctor P", "2008-01-02")]);
    expect(merged).toMatchObject({ date: "2010-03-16", dateSource: "first release (MusicBrainz)" });
  });

  it("a YouTube date that is the only date is credible", () => {
    expect(mergeSong([seed("Shut Up", "Stormzy", "2015-05-17")]).date).toBe("2015-05-17");
  });

  it("dates before 1900 or in the future are ignored", () => {
    const merged = mergeSong([mb("X", "Y", "1800-01-01"), mb("X", "Y", "2999-01-01"), mb("X", "Y", "2004-04-04")]);
    expect(merged.date).toBe("2004-04-04");
  });

  it("a future-dated row cannot make a seed date look uncorroborated", () => {
    expect(mergeSong([seed("Shut Up", "Stormzy", "2015-05-17"), mb("Shut Up", "Stormzy", "2090-01-01")]).date).toBe("2015-05-17");
  });

  it("a finer date late in a year-only period still wins over the period", () => {
    const merged = mergeSong([mb("X", "Y", "2012-06-15", "year"), seed("X", "Y", "2012-09-01")]);
    expect(merged).toMatchObject({ date: "2012-09-01", granularity: "day" });
  });

  it("keeps the identity of the chart / seed row and the union of where it lived", () => {
    const merged = mergeSong([chart("Rolling In The Deep", "Adele", "2010-12-18"), mb("Rolling in the Deep", "Adele", "2010-10-21")]);
    expect(merged).toMatchObject({ song: "Rolling In The Deep", where: ["chart", "musicbrainz"] });
  });
});

// ── a failed resolve never blocks the flight; resolveQuery never throws ──────
describe("failure", () => {
  it("every dependency throwing still returns the year when the text has one", async () => {
    const deps = fakeDeps({ index: boom, mb: boom, itunes: boom });
    expect(await resolveQuery("cuz my gear 2012", deps)).toMatchObject({ kind: "date", date: "2012-06-15", granularity: "year" });
  });

  it("every dependency throwing with no year in the text is kind none", async () => {
    const deps = fakeDeps({ index: boom, mb: boom, itunes: boom });
    expect((await resolveQuery("cuz my gear", deps)).kind).toBe("none");
  });

  it("the index failing does not stop MusicBrainz from answering", async () => {
    const deps = fakeDeps({ index: boom, mb: [mb("Cuz My Gear", "Chief Keef ft. Riff Raff", "2012-05-17")] });
    expect(asSong(await resolveQuery("chief keef cuz my gear", deps)).best.date).toBe("2012-05-17");
  });

  it("dependencies returning garbage are survived", async () => {
    const junk = [null, 42, { song: 1 }, { song: "A", artist: "B", date: "nope" }] as unknown as DatedSong[];
    const out = await resolveQuery("cuz my gear 2012", fakeDeps({ index: junk, mb: junk, itunes: junk }));
    expect(out).toMatchObject({ kind: "date", date: "2012-06-15" });
  });

  it("a dependency that never answers does not hold the outcome forever", async () => {
    vi.useFakeTimers();
    try {
      const deps: ResolverDeps = {
        indexSearch: () => new Promise(() => {}),
        musicbrainz: () => new Promise(() => {}),
        itunes: () => new Promise(() => {}),
      };
      const p = resolveQuery("cuz my gear 2012", deps);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await p).toMatchObject({ kind: "date", date: "2012-06-15" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("empty text is kind none", async () => {
    expect((await resolveQuery("   ", fakeDeps())).kind).toBe("none");
  });

  it("no match and no year is kind none, with a year hint when the artist is known", async () => {
    const deps = fakeDeps({ index: [seed("I Don't Like", "Chief Keef ft. Lil Reese", "2012-03-12"), seed("Everyday", "Chief Keef", "2012-04-07")] });
    expect(await resolveQuery("chief keef", deps)).toMatchObject({ kind: "none", yearHint: 2012 });
  });
});

describe("date outcomes", () => {
  it("a pure date makes no external calls", async () => {
    const deps = fakeDeps();
    expect(await resolveQuery("2012-04-28", deps)).toMatchObject({ kind: "date", date: "2012-04-28", granularity: "day", label: "28 Apr 2012" });
    expect(deps.musicbrainz).not.toHaveBeenCalled();
    expect(deps.itunes).not.toHaveBeenCalled();
  });

  it("a year before the charts lands on the first chart week and says why", async () => {
    const out = await resolveQuery("1955", fakeDeps());
    expect(out).toMatchObject({ kind: "date", date: "1958-08-04" });
    expect(out.kind === "date" && out.label).toContain("the Hot 100 starts 4 Aug 1958");
  });

  it('a bare year is labelled "year only"', async () => {
    const out = await resolveQuery("1999", fakeDeps());
    expect(out.kind === "date" && out.label).toBe("1999 · year only");
  });

  it("a decade flies to its middle year", async () => {
    expect(await resolveQuery("the 90s", fakeDeps())).toMatchObject({ kind: "date", date: "1995-06-15", label: "the 1990s" });
  });
});

describe("call budget", () => {
  it.each(["hold on", "shut up stormzy", "rolling in the deep 2011", "cuz my gear 2012", "chief keef - cuz my gear", "1999"])(
    '"%s" makes at most one MusicBrainz call',
    async (q) => {
      const deps = fakeDeps({ index: [chart("Rolling in the Deep", "Adele", "2010-12-18"), chart("1999", "Prince", "1982-11-06")] });
      await resolveQuery(q, deps);
      expect(deps.musicbrainz.mock.calls.length).toBeLessThanOrEqual(1);
      expect(deps.itunes.mock.calls.length).toBeLessThanOrEqual(1);
    },
  );
});

// ── browser dependencies ─────────────────────────────────────────────────────
describe("buildMbQuery", () => {
  it("tries the text without its year as a recording phrase", () => {
    expect(buildMbQuery("cuz my gear 2012")).toContain('recording:"cuz my gear"');
  });

  it("splits on the last \" by \" into recording and artist", () => {
    expect(buildMbQuery("Stand by Me by Ben E. King")).toContain('(recording:"stand by me" AND artist:"ben e king")');
  });

  it('tries both orders around " - "', () => {
    const q = buildMbQuery("Chief Keef - Cuz My Gear");
    expect(q).toContain('(recording:"cuz my gear" AND artist:"chief keef")');
    expect(q).toContain('(recording:"chief keef" AND artist:"cuz my gear")');
  });

  it("tries every artist / title boundary for loose text", () => {
    expect(buildMbQuery("chief keef my gear")).toContain('(artist:"chief keef" AND recording:"my gear")');
  });

  it("drops live recordings", () => {
    expect(buildMbQuery("1999 prince")).toMatch(/AND NOT comment:live$/);
  });

  it("cannot be steered by Lucene syntax in the input", () => {
    const q = buildMbQuery('foo" OR artist:* \\ (bar)^9');
    expect(q).not.toContain("*");
    expect(q).not.toContain("\\");
    expect(q).not.toContain(")^9");
    expect(q).not.toMatch(/artist:\*/);
  });
});

describe("mapItunes", () => {
  it("maps rows with a size-template art URL and drops karaoke albums", () => {
    const rows = mapItunes({
      results: [
        {
          kind: "song", trackName: "Rolling in the Deep", artistName: "Adele", collectionName: "21",
          releaseDate: "2010-11-29T08:00:00Z", previewUrl: "https://audio-ssl.itunes.apple.com/p.m4a",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/bb/cc/source/100x100bb.jpg",
        },
        {
          kind: "song", trackName: "Rolling in the Deep", artistName: "Studio Group", collectionName: "Karaoke Hits Vol. 3",
          releaseDate: "2011-01-01T08:00:00Z",
        },
        { kind: "music-video", trackName: "Video", artistName: "Adele", releaseDate: "2011-01-01T08:00:00Z" },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      song: "Rolling in the Deep", artist: "Adele", date: "2010-11-29", granularity: "day", onDsp: true, where: ["itunes"],
      art: "https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/bb/cc/source/{w}x{h}bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/p.m4a",
    });
  });
});

describe("mapMusicBrainz", () => {
  it("joins the artist credit, keeps the mbid and the ISRC", () => {
    const rows = mapMusicBrainz({
      recordings: [
        {
          id: "7be1d36e-49a0-481d-9181-dfac79c8f8c4", title: "Cuz My Gear", "first-release-date": "2012-05-17",
          isrcs: ["FR5R00903251"],
          "artist-credit": [{ name: "Chief Keef", joinphrase: " ft. " }, { name: "Riff Raff" }],
        },
      ],
    });
    expect(rows[0]).toMatchObject({
      song: "Cuz My Gear", artist: "Chief Keef ft. Riff Raff", date: "2012-05-17", granularity: "day",
      mbid: "7be1d36e-49a0-481d-9181-dfac79c8f8c4", isrc: "FR5R00903251", where: ["musicbrainz"],
      dateSource: "first release (MusicBrainz)", onDsp: null,
    });
  });

  it("dates a recording by its official releases; bootleg-only recordings have no credible date", () => {
    const rows = mapMusicBrainz({
      recordings: [
        {
          id: "a", title: "Alright", "first-release-date": "2014", "artist-credit": [{ name: "Kendrick Lamar" }],
          releases: [{ status: "Bootleg", date: "2014" }, { status: "Official", date: "2015-03-15" }, { status: "Official", date: "2015" }],
        },
        { id: "b", title: "Leak", "first-release-date": "2014-01-01", "artist-credit": [{ name: "X" }], releases: [{ status: "Bootleg", date: "2014-01-01" }] },
        { id: "c", title: "Plain", "first-release-date": "2013-05", "artist-credit": [{ name: "Y" }] },
      ],
    });
    expect(rows.map((r) => [r.mbid, r.date, r.granularity])).toEqual([
      ["a", "2015-03-15", "day"],
      ["c", "2013-05-15", "month"],
    ]);
  });

  it("returns [] for an unexpected payload", () => {
    expect(mapMusicBrainz(null)).toEqual([]);
    expect(mapMusicBrainz({ recordings: "x" })).toEqual([]);
  });
});

describe("browserDeps", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(body: unknown, ok = true) {
    const f = vi.fn(async (url: string) => ({ ok, url, status: ok ? 200 : 503, json: async () => body }) as unknown as Response);
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("index → GET /api/resolve?q=", async () => {
    const f = stubFetch({ rows: [chart("1999", "Prince", "1982-11-06")] });
    const rows = await browserDeps().indexSearch("1999 prince");
    expect(String(f.mock.calls[0][0])).toBe("/api/resolve?q=1999%20prince");
    expect(rows[0].song).toBe("1999");
  });

  it("musicbrainz → one WS/2 recording search, fmt=json, limit=8", async () => {
    const f = stubFetch({
      recordings: [{ id: "x", title: "Cuz My Gear", "first-release-date": "2012-05-17", "artist-credit": [{ name: "Chief Keef" }] }],
    });
    const rows = await browserDeps().musicbrainz("cuz my gear by chief keef");
    expect(f).toHaveBeenCalledTimes(1);
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://musicbrainz.org/ws/2/recording");
    expect(url.searchParams.get("fmt")).toBe("json");
    expect(url.searchParams.get("limit")).toBe("8");
    expect(url.searchParams.get("query")).toContain('(recording:"cuz my gear" AND artist:"chief keef")');
    expect(rows[0].mbid).toBe("x");
  });

  it("itunes → Search API, songs, limit 8", async () => {
    const f = stubFetch({ results: [] });
    await browserDeps().itunes("adele rolling in the deep");
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://itunes.apple.com/search");
    expect(url.searchParams.get("media")).toBe("music");
    expect(url.searchParams.get("entity")).toBe("song");
    expect(url.searchParams.get("limit")).toBe("8");
    expect(url.searchParams.get("term")).toBe("adele rolling in the deep");
  });

  it("a non-OK response rejects, so the resolver can fall back", async () => {
    stubFetch({}, false);
    await expect(browserDeps().musicbrainz("anything")).rejects.toThrow();
  });

  it("end to end with browserDeps: a 503 from MusicBrainz still flies to the year", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("/api/resolve")) return { ok: true, status: 200, json: async () => ({ rows: [] }) };
        return { ok: false, status: 503, json: async () => ({}) };
      }),
    );
    expect(await resolveQuery("some deep cut 2011", browserDeps())).toMatchObject({ kind: "date", date: "2011-06-15" });
  });
});
