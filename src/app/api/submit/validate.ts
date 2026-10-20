// Validation for POST /api/submit. Pure: no I/O, so the route test can drive every branch.

export const FIRST_MONTH = "1958-08"; // the first Hot 100 week, 1958-08-04
export const MAX_SONG = 120;
export const MAX_ARTIST = 120;
export const MAX_NOTE = 280;
export const MAX_LINK = 400;
export const MAX_BODY_BYTES = 4096;

/** Hosts a "Where can we hear it?" link may point at. `sub: true` also allows subdomains (m., www., artist.bandcamp.com). */
const LINK_HOSTS: { host: string; sub: boolean }[] = [
  { host: "youtube.com", sub: true },
  { host: "youtu.be", sub: false },
  { host: "soundcloud.com", sub: true },
  { host: "open.spotify.com", sub: false },
  { host: "music.apple.com", sub: false },
  { host: "bandcamp.com", sub: true },
  { host: "audiomack.com", sub: true },
];

export interface Submission { song: string; artist: string; month: string; note?: string; link?: string }
export type Checked =
  | { kind: "ok"; value: Submission }
  | { kind: "honeypot" }
  | { kind: "invalid"; field: string; error: string };

// C0/C1 controls, plus zero-width and bidi overrides that can disguise text.
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Strip control characters (whitespace controls become spaces), collapse runs of spaces, trim. */
export function cleanText(s: string): string {
  return s.replace(/[\t\n\r\v\f]/g, " ").replace(CONTROL, "").replace(/ {2,}/g, " ").trim();
}

/** The current month in UTC, "YYYY-MM". */
export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function validMonth(month: string, now = new Date()): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= FIRST_MONTH && month <= currentMonth(now);
}

/** Returns the normalised https URL, or null when the link is not on an allowed host. */
export function allowedLink(raw: string): string | null {
  if (raw.length > MAX_LINK) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const ok = LINK_HOSTS.some((h) => host === h.host || (h.sub && host.endsWith(`.${h.host}`)));
  return ok ? u.toString() : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function checkSubmission(body: unknown, now = new Date()): Checked {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { kind: "invalid", field: "body", error: "Send a JSON object." };
  const b = body as Record<string, unknown>;

  // Honeypot: a hidden field people never see. Anything in it means a bot; pretend it worked.
  const website = b.website;
  if (website !== undefined && website !== null && !(typeof website === "string" && website.trim() === "")) return { kind: "honeypot" };

  const songRaw = str(b.song), artistRaw = str(b.artist), monthRaw = str(b.month);
  if (songRaw === null || artistRaw === null || monthRaw === null) {
    return { kind: "invalid", field: songRaw === null ? "song" : artistRaw === null ? "artist" : "month", error: "Song, artist and month are required." };
  }
  // Refuse oversize input before cleaning, so a megabyte of control characters cannot squeeze under the limit.
  if (songRaw.length > MAX_SONG * 2) return { kind: "invalid", field: "song", error: `Song is ${MAX_SONG} characters at most.` };
  if (artistRaw.length > MAX_ARTIST * 2) return { kind: "invalid", field: "artist", error: `Artist is ${MAX_ARTIST} characters at most.` };

  const song = cleanText(songRaw), artist = cleanText(artistRaw), month = monthRaw.trim();
  if (song.length < 1 || song.length > MAX_SONG) return { kind: "invalid", field: "song", error: `Song needs 1 to ${MAX_SONG} characters.` };
  if (artist.length < 1 || artist.length > MAX_ARTIST) return { kind: "invalid", field: "artist", error: `Artist needs 1 to ${MAX_ARTIST} characters.` };
  if (!validMonth(month, now)) return { kind: "invalid", field: "month", error: `Month must be YYYY-MM, from ${FIRST_MONTH} to ${currentMonth(now)}.` };

  const value: Submission = { song, artist, month };

  if (b.note !== undefined && b.note !== null) {
    const noteRaw = str(b.note);
    if (noteRaw === null || noteRaw.length > MAX_NOTE * 2) return { kind: "invalid", field: "note", error: `Note is ${MAX_NOTE} characters at most.` };
    const note = cleanText(noteRaw);
    if (note.length > MAX_NOTE) return { kind: "invalid", field: "note", error: `Note is ${MAX_NOTE} characters at most.` };
    if (note) value.note = note;
  }

  if (b.link !== undefined && b.link !== null) {
    const linkRaw = str(b.link);
    if (linkRaw === null) return { kind: "invalid", field: "link", error: "Link must be text." };
    const trimmed = linkRaw.trim();
    if (trimmed) {
      const link = allowedLink(trimmed);
      if (!link) return { kind: "invalid", field: "link", error: "Links can point at YouTube, SoundCloud, Spotify, Apple Music, Bandcamp or Audiomack (https)." };
      value.link = link;
    }
  }

  return { kind: "ok", value };
}
