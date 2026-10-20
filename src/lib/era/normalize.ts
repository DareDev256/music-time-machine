// Text normalisation shared by the resolver and /api/resolve. Both sides of every comparison go through
// here, so "Beyoncé", "BEYONCE" and "beyonce" meet, "&" meets "and", and "(feat. X)" never blocks a match.
// Unicode-aware patterns are built with RegExp() so they compile on the ES2017 target.

const MARKS = new RegExp("\\p{M}+", "gu");
const NON_ALNUM = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const DOT_IN_WORD = new RegExp("(\\p{L})\\.(?=\\p{L})", "gu");
// A censored word ("N*gga", "N****", "B*tch") is said by its initial ("the n word"), and services censor it
// differently, so it normalises to that initial: every spelling meets, and so does what people type.
const CENSORED = new RegExp("(\\p{L})\\p{L}*\\*[\\p{L}*]*", "gu");
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

const ASCII_ONLY = /^[\x00-\x7f]*$/;
const CENSORED_ASCII = /([a-z])[a-z]*\*[a-z*]*/g;

/** lowercase, accents stripped, apostrophes joined, & / + → and, $ → s, everything else non-alphanumeric → one space. */
export function norm(s: unknown): string {
  if (typeof s !== "string" || !s) return "";
  // Fast path for plain ASCII (nearly every index string): the same steps without Unicode decomposition or
  // property classes. Proven identical to normUnicode over the whole index in resolve.realindex.test.ts.
  if (ASCII_ONLY.test(s)) {
    let t = s.toLowerCase();
    if (t.includes("*")) t = t.replace(CENSORED_ASCII, "$1");
    t = t.replace(/['`]/g, "");
    t = t.replace(/[&+]/g, " and ").replace(/\$/g, "s").replace(/([a-z])!([a-z])/g, "$1i$2");
    t = t.replace(/([a-z])\.(?=[a-z])/g, "$1");
    return t.replace(/[^a-z0-9]+/g, " ").trim();
  }
  return normUnicode(s);
}

/** The general path of norm, for any script. */
export function normUnicode(s: string): string {
  let t = s.normalize("NFKD").replace(MARKS, "").toLowerCase();
  t = t.replace(/[‘’ʼ'`´]/g, "");
  if (t.includes("*")) t = t.replace(CENSORED, "$1");
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
  // how people name a song they can't spell or say: "the n word song", "official video", "lyrics", "remix"
  "word", "remix", "official", "video", "lyrics", "lyric", "audio",
  // how people describe one: "the one that goes", "or the other one", "she said"
  "or", "one", "goes", "go", "said", "says", "sings", "sang", "this", "where", "which", "who",
]);

/**
 * Words that never belong to what was named, even when typed: they don't count against a reading that leaves them
 * out ("hotline bling official video"). Unlike STOPWORDS, small title words ("of", "on", "the") are not here, so a
 * reading that leaves "of" unexplained ("shake it" for "shake it of") explains less than one that uses it.
 */
export const FILLER: ReadonlySet<string> = new Set([
  "by", "ft", "feat", "featuring", "prod", "produced", "song", "songs", "track", "tune",
  "word", "remix", "official", "video", "lyrics", "lyric", "audio",
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
  const stripped = stripTitle(title);
  const full = String(title ?? "").replace(/[()[\]{}]/g, " ");
  const a = norm(stripped);
  const b = full === stripped ? a : norm(full);
  return Array.from(new Set([a, b].filter(Boolean)));
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

// Spoken intros dropped from the start of the text. Never single words that start titles ("Hey Jude", "Uh Huh", "So Sick").
const INTRO = [
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

// ── typo tolerance ────────────────────────────────────────────────────────────

/**
 * A spelling-insensitive key for one token: soft c → s, other c / q → k, ph → f, ck → k, z → s, a final
 * ie / ey / ee / y → i, y → i, doubled letters collapsed. "billy" and "billie" are two edits apart but share a key;
 * so do "despasito" / "despacito" and "tenessee" / "tennessee".
 */
export function soundKey(t: string): string {
  return t
    .replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/z/g, "s")
    .replace(/(?:ie|ey|ee|y)$/, "i").replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");
}

/** True when a and b are at most one edit apart (substitution, insertion, deletion or adjacent swap); no allocation. */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // deletion / insertion
}

let rowA = new Int32Array(32);
let rowB = new Int32Array(32);
let rowC = new Int32Array(32);

/** Optimal-string-alignment distance (a swap counts as one edit), giving up once it must exceed `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (max <= 1) return a === b ? 0 : withinOne(a, b) ? 1 : 2;
  const n = b.length;
  if (rowA.length < n + 1) {
    rowA = new Int32Array(n + 1);
    rowB = new Int32Array(n + 1);
    rowC = new Int32Array(n + 1);
  }
  let prev2 = rowA;
  let prev = rowB;
  let cur = rowC;
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return prev[n];
}

/**
 * How well a typed token matches an indexed one: 1 exact; 0.9 same sound key; 0.85 within one edit (4–7 letters)
 * or two (8+); 0.8 a prefix of 3+ letters covering at least 60% of the word ("shmurd" → "shmurda"); else 0.
 * Anything with a digit matches only exactly, so 1999 is never 1990.
 */
export function tokenSim(q: string, t: string): number {
  if (q === t) return 1;
  if (!q || !t || /\d/.test(q) || /\d/.test(t)) return 0;
  if (q.length >= 3 && t.length >= 3 && soundKey(q) === soundKey(t)) return 0.9;
  const max = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  if (max && t.length >= 4 && editDistance(q, t, max) <= max) return 0.85;
  if (q.length >= 3 && t.length > q.length && t.startsWith(q) && q.length >= 0.6 * t.length) return 0.8;
  return 0;
}

/**
 * Best fuzzy alignment of `needle` as a contiguous run inside `hay` (token arrays): mean similarity, or 0.
 * With `allowShort`, one 2–3 letter word may be a single edit off ("shake it of" → "shake it off") provided every
 * other word of the run matches exactly and those exact words carry at least 4 letters; that word scores 0.75.
 */
export function fuzzyPhrase(hay: string[], needle: string[], min = 0.8, allowShort = false): { sim: number; start: number } {
  let best = { sim: 0, start: -1 };
  if (!needle.length || needle.length > hay.length) return best;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let sum = 0;
    let shortAt = -1;
    let exactLetters = 0;
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      const a = hay[i + j];
      const b = needle[j];
      const s = tokenSim(a, b);
      if (s === 1) exactLetters += b.length;
      if (s >= min) {
        sum += s;
        continue;
      }
      const short = allowShort && shortAt < 0 && Math.min(a.length, b.length) >= 2 && Math.min(a.length, b.length) <= 3 && !/\d/.test(a + b) && editDistance(a, b, 1) <= 1;
      if (!short) {
        ok = false;
        break;
      }
      shortAt = j;
      sum += 0.75;
    }
    if (ok && shortAt >= 0) {
      // the rest of the run must be exact, and substantial
      const restExact = needle.every((b, j) => j === shortAt || hay[i + j] === b);
      if (!restExact || exactLetters < 4) ok = false;
    }
    if (ok && sum / needle.length > best.sim) best = { sim: sum / needle.length, start: i };
  }
  return best;
}

/**
 * A single typed word against a multi-word name with its spaces removed: "chiefkeef" → "chief keef", "lilpeep" →
 * "lil peep", "hotlinebling" → "hotline bling". Typos allowed as in tokenSim (the joined name is long).
 */
export function compactSim(word: string, name: string[]): number {
  if (name.length < 2 || word.length < 6) return 0;
  return tokenSim(word, name.join(""));
}
