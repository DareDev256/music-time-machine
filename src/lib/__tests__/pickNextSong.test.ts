import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RecentSong } from "@/hooks/useRecentlyViewed";

// ── Mock the data layer so tests don't depend on real catalog size ────────────
// vi.mock factories are hoisted above all imports/variables, so data must live
// inside the factory or use vi.hoisted() to be available at hoist-time.

const { MOCK_CATALOG, MOCK_GENRES } = vi.hoisted(() => {
  const MOCK_CATALOG: Record<string, { artist: string; spotify?: { popularity: number } | null }> = {
    "song-a": { artist: "Alpha", spotify: { popularity: 80 } },
    "song-b": { artist: "Beta feat. Gamma", spotify: { popularity: 60 } },
    "song-c": { artist: "Delta & Epsilon", spotify: { popularity: 40 } },
    "song-d": { artist: "Zeta ft. Eta", spotify: { popularity: 90 } },
    "song-e": { artist: "Theta with Iota", spotify: null },
  };

  const MOCK_GENRES: Record<string, string> = {
    "song-a": "Rock",
    "song-b": "Hip-Hop",
    "song-c": "Rock",
    "song-d": "Jazz",
    "song-e": "Electronic",
  };

  return { MOCK_CATALOG, MOCK_GENRES };
});

vi.mock("@/lib/mockData", () => ({
  mockSongs: MOCK_CATALOG,
  songGenres: MOCK_GENRES,
}));

import { pickNextSong, primaryArtist, genreOf } from "../pickNextSong";

// ── Helpers ──────────────────────────────────────────────────────────────────

function recent(id: string, artist: string, viewedAt = Date.now()): RecentSong {
  return { id, title: `Title ${id}`, artist, albumArt: "", viewedAt };
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── primaryArtist ────────────────────────────────────────────────────────────

describe("primaryArtist", () => {
  it("returns sole artist unchanged", () => {
    expect(primaryArtist("Drake")).toBe("Drake");
  });

  it.each([
    ["Drake feat. Rihanna", "Drake"],
    ["Drake ft. Future", "Drake"],
    ["Kanye & Jay-Z", "Kanye"],
    ["Billie, Khalid", "Billie"],
    ["Post Malone with Swae Lee", "Post Malone"],
  ])("splits compound credit '%s' → '%s'", (input, expected) => {
    expect(primaryArtist(input)).toBe(expected);
  });

  it("is case-insensitive for delimiters", () => {
    expect(primaryArtist("A FEAT. B")).toBe("A");
    expect(primaryArtist("A Feat. B")).toBe("A");
  });

  it("handles empty string without throwing", () => {
    expect(primaryArtist("")).toBe("");
  });
});

// ── genreOf ──────────────────────────────────────────────────────────────────

describe("genreOf", () => {
  it("returns mapped genre for known song", () => {
    expect(genreOf("song-a")).toBe("Rock");
  });

  it("returns 'Unknown' for unmapped song ID", () => {
    expect(genreOf("nonexistent")).toBe("Unknown");
  });
});

// ── pickNextSong — empty history ─────────────────────────────────────────────

describe("pickNextSong — no history", () => {
  it("returns a valid catalog ID with 'Random discovery' reason", () => {
    const result = pickNextSong([]);
    expect(Object.keys(MOCK_CATALOG)).toContain(result.id);
    expect(result.reason).toBe("Random discovery");
  });

  it("attaches the correct genre for the picked song", () => {
    const result = pickNextSong([]);
    expect(result.genre).toBe(MOCK_GENRES[result.id]);
  });

  it("uses Math.random to select index", () => {
    // random() → 0 means index 0 → first key
    const result = pickNextSong([]);
    expect(result.id).toBe(Object.keys(MOCK_CATALOG)[0]);
  });
});

// ── pickNextSong — with history (novelty scoring) ────────────────────────────

describe("pickNextSong — novelty scoring", () => {
  it("avoids songs already in recent history", () => {
    const history = [recent("song-a", "Alpha")];
    const result = pickNextSong(history);
    expect(result.id).not.toBe("song-a");
  });

  it("prefers unexplored genres (+30 bonus)", () => {
    // View song-a (Rock) and song-b (Hip-Hop) — Jazz and Electronic are unexplored
    const history = [
      recent("song-a", "Alpha"),
      recent("song-b", "Beta feat. Gamma"),
    ];
    const result = pickNextSong(history);
    // song-d (Jazz) or song-e (Electronic) should win — both have unexplored genres
    expect(["song-d", "song-e"]).toContain(result.id);
  });

  it("labels pick as 'New genre' when genre is unexplored", () => {
    const history = [recent("song-a", "Alpha")];
    const result = pickNextSong(history);
    expect(result.reason).toMatch(/^New genre:/);
  });

  it("penalizes over-represented genres", () => {
    // View both Rock songs — remaining candidates all have fresh genres
    const history = [
      recent("song-a", "Alpha"),
      recent("song-c", "Delta & Epsilon"),
    ];
    const result = pickNextSong(history);
    const genre = MOCK_GENRES[result.id];
    expect(genre).not.toBe("Rock");
  });

  it("labels pick as 'New artist' when genre is known but artist is new", () => {
    // View all but song-c. Song-c's genre (Rock) is viewed, but Delta is new artist
    const history = [
      recent("song-a", "Alpha"),
      recent("song-b", "Beta feat. Gamma"),
      recent("song-d", "Zeta ft. Eta"),
      recent("song-e", "Theta with Iota"),
    ];
    const result = pickNextSong(history);
    expect(result.id).toBe("song-c");
    expect(result.reason).toBe("New artist: Delta");
  });
});

// ── pickNextSong — entire catalog viewed (revisit path) ──────────────────────

describe("pickNextSong — all songs viewed (revisit)", () => {
  it("returns least-recently-viewed song", () => {
    const now = Date.now();
    const history = [
      recent("song-a", "Alpha", now - 5000),   // oldest
      recent("song-b", "Beta", now - 4000),
      recent("song-c", "Delta", now - 3000),
      recent("song-d", "Zeta", now - 2000),
      recent("song-e", "Theta", now - 1000),    // newest
    ];
    const result = pickNextSong(history);
    expect(result.id).toBe("song-a");
    expect(result.reason).toBe("Revisit — it's been a while");
  });

  it("returns correct genre for revisited song", () => {
    const now = Date.now();
    const history = Object.keys(MOCK_CATALOG).map((id, i) =>
      recent(id, MOCK_CATALOG[id].artist, now - (5 - i) * 1000),
    );
    const result = pickNextSong(history);
    expect(result.genre).toBe(MOCK_GENRES[result.id]);
  });
});

// ── pickNextSong — empty catalog guard ───────────────────────────────────────

describe("pickNextSong — empty catalog", () => {
  it("returns safe fallback when catalog is empty", async () => {
    const mockDataModule = await import("@/lib/mockData");
    const originalSongs = { ...mockDataModule.mockSongs };

    for (const key of Object.keys(mockDataModule.mockSongs)) {
      delete mockDataModule.mockSongs[key];
    }

    const result = pickNextSong([]);
    expect(result).toEqual({ id: "", reason: "No songs available", genre: "Unknown" });

    Object.assign(mockDataModule.mockSongs, originalSongs);
  });
});

// ── pickNextSong — randomness boundary ───────────────────────────────────────

describe("pickNextSong — top-N randomness", () => {
  it("selects from top 3 candidates when multiple score equally", () => {
    const history = [recent("song-a", "Alpha")];

    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick1 = pickNextSong(history);

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pick2 = pickNextSong(history);

    expect(Object.keys(MOCK_CATALOG)).toContain(pick1.id);
    expect(Object.keys(MOCK_CATALOG)).toContain(pick2.id);
  });

  it("handles single remaining candidate without bounds error", () => {
    const now = Date.now();
    const history = [
      recent("song-a", "Alpha", now - 4000),
      recent("song-b", "Beta", now - 3000),
      recent("song-c", "Delta", now - 2000),
      recent("song-d", "Zeta", now - 1000),
    ];
    const result = pickNextSong(history);
    expect(result.id).toBe("song-e");
  });
});

// ── pickNextSong — result shape contract ─────────────────────────────────────

describe("pickNextSong — PickResult contract", () => {
  it("always returns { id, reason, genre } regardless of code path", () => {
    const cases: RecentSong[][] = [
      [],
      [recent("song-a", "Alpha")],
      Object.keys(MOCK_CATALOG).map((id, i) =>
        recent(id, MOCK_CATALOG[id].artist, i),
      ),
    ];

    for (const history of cases) {
      const result = pickNextSong(history);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("genre");
      expect(typeof result.id).toBe("string");
      expect(typeof result.reason).toBe("string");
      expect(typeof result.genre).toBe("string");
    }
  });
});
