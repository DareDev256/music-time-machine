// Text normalisation shared by the resolver and /api/resolve. Both sides of every comparison go through
// here, so "Beyoncé", "BEYONCE" and "beyonce" meet, "&" meets "and", and "(feat. X)" never blocks a match.
// Unicode-aware patterns are built with RegExp() so they compile on the ES2017 target.

const MARKS = new RegExp("\\p{M}+", "gu");
const NON_ALNUM = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const DOT_IN_WORD = new RegExp("(\\p{L})\\.(?=\\p{L})", "gu");
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

/** lowercase, accents stripped, apostrophes joined, & / + → and, $ → s, everything else non-alphanumeric → one space. */
export function norm(s: unknown): string {
  if (typeof s !== "string" || !s) return "";
  let t = s.normalize("NFKD").replace(MARKS, "").toLowerCase();
  t = t.replace(/[‘’ʼ'`´]/g, "");
  t = t.replace(/[&+]/g, " and ").replace(/\$/g, "s").replace(/([a-z])!([a-z])/g, "$1i$2");
  t = t.replace(DOT_IN_WORD, "$1");
  return t.replace(NON_ALNUM, " ").trim();
}

export function tokens(s: unknown): string[] {
  const n = norm(s);
  return n ? n.split(" ") : [];
}

/**
 * Words that carry no title or artist meaning in a typed sentence ("i was listening to X by Y in 2012").
 * They are never REQUIRED to match; they still count when they are part of a title phrase.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "by", "ft", "feat", "featuring", "prod", "produced", "song", "songs", "track", "tune",
  "i", "im", "was", "were", "listening", "listen", "listened", "playing", "played", "called", "remember",
  "back", "when", "that", "to", "in", "around", "during", "from", "the", "a", "an", "and", "x", "with", "vs", "on", "of",
]);

export const isStopword = (t: string): boolean => STOPWORDS.has(t);

/** Does `needle` occur in `hay` as whole words? Both already normalised. */
export function containsPhrase(hay: string, needle: string): boolean {
  if (!needle || !hay) return false;
  return ` ${hay} `.includes(` ${needle} `);
}

/** A title without its parentheticals, "feat." tail and " - Remastered"-style suffix. */
export function stripTitle(title: string): string {
  const t = String(title ?? "")
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/i, "")
    .replace(/\s+[-–—]\s+(?:\d{4}\s+)?(?:re-?master(?:ed)?|live|radio|single|album|mono|stereo|edit|version|mix|remix|explicit|clean)\b.*$/i, "")
    .trim();
  return t || String(title ?? "");
}

/** The normalised forms a title can be matched by: stripped, and with its parenthetical words kept. */
export function titleForms(title: string): string[] {
  const forms = [norm(stripTitle(title)), norm(String(title ?? "").replace(/[()[\]{}]/g, " "))].filter(Boolean);
  return Array.from(new Set(forms));
}

/** The key two rows must share to be the same song: the stripped, normalised title. */
export const titleKey = (title: string): string => norm(stripTitle(title)) || norm(title);

const FEAT_SPLIT = /\s+(?:feat\.?|ft\.?|featuring|with|x|vs\.?)\s+/i;
const GROUP_SPLIT = /\s*(?:,|&|\+|\band\b)\s*/i;

/** Normalised artist name with a leading "the" dropped ("The Weeknd" → "weeknd"). */
export const artistKey = (a: string): string => norm(a).replace(/^the /, "");

/** The primary artist's key: "Chief Keef ft. Riff Raff" → "chief keef". "Earth, Wind & Fire" stays whole. */
export const primaryArtistKey = (a: string): string => artistKey(String(a ?? "").split(FEAT_SPLIT)[0]);

/** The primary artist as written, for building external queries. */
export const primaryArtistName = (a: string): string => String(a ?? "").split(FEAT_SPLIT)[0].trim();

/**
 * Names a query can use to mean this artist (strict): the primary as written, every featured artist,
 * and each "&"-joined member that is distinctive enough on its own (two words, or five letters).
 */
export function artistNames(artist: string): string[] {
  const parts = String(artist ?? "").split(FEAT_SPLIT);
  const out = new Set<string>();
  out.add(artistKey(parts[0]));
  for (const featured of parts.slice(1)) {
    out.add(artistKey(featured));
    for (const p of featured.split(GROUP_SPLIT)) out.add(artistKey(p));
  }
  for (const p of parts[0].split(GROUP_SPLIT)) {
    const k = artistKey(p);
    if (k.includes(" ") || k.length >= 5) out.add(k);
  }
  return Array.from(out).filter((k) => k.length >= 2);
}

/** The lead credit's names: "Chief Keef & Riff Raff ft. X" → {"chief keef and riff raff", "chief keef", "riff raff"}. */
export function primaryKeysLoose(artist: string): Set<string> {
  const primary = String(artist ?? "").split(FEAT_SPLIT)[0];
  const out = new Set<string>([artistKey(primary)]);
  for (const p of primary.split(GROUP_SPLIT)) {
    const k = artistKey(p);
    if (k.length >= 2) out.add(k);
  }
  return out;
}

/** Every name in a credit (loose), used to decide two differently-credited rows are the same song. */
export function artistKeysLoose(artist: string): Set<string> {
  const out = new Set(artistNames(artist));
  for (const part of String(artist ?? "").split(FEAT_SPLIT)) {
    for (const p of part.split(GROUP_SPLIT)) {
      const k = artistKey(p);
      if (k.length >= 2) out.add(k);
    }
  }
  return out;
}

const INTRO = [
  /^(?:hey|so|yo|ok|okay|um+|uh+)[,!.]?\s+/i,
  /^(?:i\s+)?(?:was|were|kept|been)\s+(?:listening\s+to|playing|bumping|blasting|spinning|on|into|obsessed\s+with)\s+/i,
  /^i\s+(?:used\s+to\s+)?(?:listen\s+to|play|bump|blast)\s+/i,
  /^listening\s+to\s+/i,
  /^(?:the|that)\s+song\s+/i,
];

/** Query text as typed, made safe: control characters out, whitespace collapsed, ≤ 200 chars, spoken intros dropped. */
export function cleanQuery(q: unknown): string {
  let t = typeof q === "string" ? q : "";
  t = t.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, 200).trim();
  for (const re of INTRO) t = t.replace(re, "");
  return t.trim();
}

export const hasControlChars = (s: string): boolean => /[\u0000-\u001F\u007F-\u009F]/.test(s);
