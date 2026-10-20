// Query parsing for /api/card. Pure: no file reads, no network, so it is tested on its own.

export const FIRST_CHART_WEEK = "1958-08-04";
export const MAX_TEXT = 120;

export type CardFormat = "story" | "wide";
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  wide: { width: 1200, height: 630 },
};

export type CardRequest =
  | { kind: "error"; status: 400; error: string }
  | { kind: "default"; format: CardFormat }
  | {
      kind: "card";
      format: CardFormat;
      song: string | null;
      artist: string | null;
      /** The date the card shows: the request date, or the first chart week when it was earlier. */
      date: string;
      /** True when the requested date was before the Hot 100 and was moved to its first week. */
      clamped: boolean;
    };

// Control, format (bidi overrides, zero-width), private-use and surrogate code points never print on a card.
const UNPRINTABLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\u2028\u2029]/gu;
// The card carries no emoji: pictographs, their presentation selectors and skin-tone modifiers go.
const PICTOGRAPH = /[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{20E3}]/gu;

/** Trim, strip what cannot print, collapse whitespace, cap at MAX_TEXT code points. Empty → null. */
export function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = value.normalize("NFC").replace(UNPRINTABLE, "").replace(PICTOGRAPH, "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return Array.from(s).slice(0, MAX_TEXT).join("").trim();
}

/** A real calendar date in YYYY-MM-DD form (rejects 2012-02-30, 2012-13-01). */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export interface ParseOptions {
  /** Today in YYYY-MM-DD (UTC); dates after it are refused. */
  today?: string;
  /** Where a card with a song but no date gets its date (the index's first-seen date). */
  lookupDate?: (song: string, artist: string | null) => string | null;
}

export function parseCardParams(params: URLSearchParams, opts: ParseOptions = {}): CardRequest {
  const rawFormat = params.get("format");
  if (rawFormat !== null && rawFormat !== "story" && rawFormat !== "wide") {
    return { kind: "error", status: 400, error: "format must be story or wide" };
  }
  // Link previews are the common unparameterised use, so wide is the default shape.
  const format: CardFormat = rawFormat ?? "wide";

  const song = cleanText(params.get("song"));
  const artist = cleanText(params.get("artist"));
  const rawDate = params.get("date");

  if (rawDate === null && !song && !artist) return { kind: "default", format };

  let date: string | null = null;
  if (rawDate !== null) {
    const d = rawDate.trim();
    if (!isRealDate(d)) return { kind: "error", status: 400, error: "date must be a real date in YYYY-MM-DD form" };
    date = d;
  } else if (song) {
    const found = opts.lookupDate?.(song, artist) ?? null;
    if (found && isRealDate(found)) date = found;
  }
  if (!date) return { kind: "error", status: 400, error: "date must be a real date in YYYY-MM-DD form" };

  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (date > today) return { kind: "error", status: 400, error: "date is in the future" };

  const clamped = date < FIRST_CHART_WEEK;
  return { kind: "card", format, song, artist: song ? artist : null, date: clamped ? FIRST_CHART_WEEK : date, clamped };
}
