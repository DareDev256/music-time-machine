// GET /api/youtube?q= — the resolver's last lookup: one YouTube search, asked only after the index, MusicBrainz and
// iTunes found nothing (spec §12, "A"). Server-side so the key never reaches a browser.
// Quota: a search costs 100 of the project's 10,000 units a day, shared with the channel crawl. So each answer is
// kept a day here and at the CDN, an instance spends at most DAILY_SEARCHES, a visitor gets PER_HOUR, and a
// quotaExceeded pauses searching for an hour instead of retrying into the wall.
// YouTube API Developer Policies: API data may be stored at most 30 days; nothing here is kept past a day (+7 stale).

import { NextResponse } from "next/server";
import { cleanQuery, hasControlChars, norm } from "@/lib/era/normalize";
import { mapYouTubeSearch } from "@/lib/era/youtube";
import { extractClientIp, tryConsume } from "@/lib/rateLimit";
import type { DatedSong } from "@/lib/era/types";

export const runtime = "nodejs";

const MAX_Q = 200;
const DAY_MS = 86_400_000;
const PER_HOUR = 10;
const DAILY_SEARCHES = 60;
const PAUSE_MS = 3_600_000;
const MAX_CACHED = 500;
const TIMEOUT_MS = 7_000;

type Answer = { rows: DatedSong[]; at: number };
const cache = new Map<string, Answer>();
let spent = { day: "", n: 0 };
let pausedUntil = 0;

const BASE = { "X-Content-Type-Options": "nosniff" };
const reply = (rows: DatedSong[], state: string, cacheable: boolean) =>
  NextResponse.json(
    { rows },
    {
      status: 200,
      headers: {
        ...BASE,
        "x-youtube": state,
        "Cache-Control": cacheable ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
      },
    },
  );
const bad = (error: string) => NextResponse.json({ error }, { status: 400, headers: { ...BASE, "Cache-Control": "no-store" } });

function remember(key: string, rows: DatedSong[]) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { rows, at: Date.now() });
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (q === null || !q.trim()) return bad("q is required");
  if (q.length > MAX_Q) return bad(`q must be at most ${MAX_Q} characters`);
  if (hasControlChars(q)) return bad("q must not contain control characters");
  const text = cleanQuery(q);
  const key = norm(text);
  if (!key) return bad("q is required");

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY_MS) return reply(hit.rows, "cached", true);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return reply([], "unconfigured", false);
  if (Date.now() < pausedUntil) return reply([], "paused", false);
  const today = new Date().toISOString().slice(0, 10);
  if (spent.day !== today) spent = { day: today, n: 0 };
  if (spent.n >= DAILY_SEARCHES) return reply([], "budget", false);
  if (!tryConsume(`youtube:${extractClientIp(request)}`, PER_HOUR, 3_600_000)) {
    return NextResponse.json({ rows: [] }, { status: 429, headers: { ...BASE, "Cache-Control": "no-store", "Retry-After": "3600" } });
  }

  spent.n += 1;
  const url =
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&safeSearch=none" +
    `&q=${encodeURIComponent(text)}&key=${encodeURIComponent(apiKey)}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { errors?: Array<{ reason?: string }> } } | null;
      const reason = body?.error?.errors?.[0]?.reason ?? `HTTP ${res.status}`;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || res.status === 429) pausedUntil = Date.now() + PAUSE_MS;
      console.error(`youtube: search failed (${reason})`); // never the URL: it carries the key
      return reply([], "error", false);
    }
    const rows = mapYouTubeSearch(await res.json());
    remember(key, rows);
    return reply(rows, "live", true);
  } catch (e) {
    console.error(`youtube: search failed (${e instanceof Error && e.name === "AbortError" ? "timeout" : "network"})`);
    return reply([], "error", false);
  } finally {
    clearTimeout(timer);
  }
}
