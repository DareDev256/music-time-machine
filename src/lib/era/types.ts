// Shared shapes for the era engine: what a resolved song looks like, and what the resolver returns.

export type Granularity = "day" | "month" | "year";

export interface DatedSong {
  song: string;
  artist: string;
  /** Always YYYY-MM-DD. A partial date is padded to the middle of its period (2012 → 2012-06-15), never Jan 1. */
  date: string;
  granularity: Granularity;
  dateSource: string; // human: "uploaded to YouTube", "first release (MusicBrainz)", "entered the Hot 100"
  where: Array<"chart" | "musicbrainz" | "itunes" | "seed" | "youtube">;
  onDsp: boolean | null;
  art?: string;
  previewUrl?: string;
  youtubeId?: string;
  mbid?: string;
  isrc?: string;
  /** Best Hot 100 peak (1–100) when the index knows it. Ranks songs that share a title ("Billie Jean": #1 vs #47). */
  peak?: number;
  /** Set when this is another recording than the original: "remix", "live", "acoustic", "sped up", "cast recording"… */
  version?: string;
}

export type ResolveOutcome =
  /** needsPick: the match is ambiguous (a common title with no artist and no year); show the candidates, don't auto-launch. */
  | { kind: "song"; best: DatedSong; candidates: DatedSong[]; needsPick?: boolean }
  | { kind: "date"; date: string; granularity: Granularity; label: string }
  | { kind: "none"; reason: string; yearHint?: number };

/** One row of public/era/index.json (built by data/scripts/build_index.py). Extra optional fields are read when present. */
export interface IndexFileRow {
  s: string;
  a: string;
  d: string;
  g: Granularity;
  src: string; // "hot100" | "lane:<id>" | "heat:<id>" | "seed"
  k: string;
  ds?: string; // human date label
  y?: string; // YouTube id
  n?: string; // note
  w?: string[]; // where (seed rows)
  dsp?: boolean; // on a DSP (seed rows)
  p?: number; // best Hot 100 peak (1–100): ranks songs that share a title
  [extra: string]: unknown;
}
