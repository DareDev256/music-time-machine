// Server-side read of approved listener submissions for one month ("Remembered by listeners").
// Never throws: any error, a slow Convex, or NEXT_PUBLIC_CONVEX_URL unset all give [].

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { allowedLink } from "@/app/api/submit/validate";

export interface Remembered { song: string; artist: string; note?: string; link?: string; verdict: string; earliest?: string }

const TIMEOUT_MS = 2500;
const TTL_MS = 60_000;
const MAX_ROWS = 20;
const cache = new Map<string, { at: number; rows: Remembered[] }>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Approved submissions for "YYYY-MM", newest first, at most 20. Cached per month for a minute per server instance. */
export async function rememberedFor(month: string): Promise<Remembered[]> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const hit = cache.get(month);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  try {
    const raw = await withTimeout(new ConvexHttpClient(url).query(api.submissions.approvedForMonth, { month }), TIMEOUT_MS);
    const rows: Remembered[] = (Array.isArray(raw) ? raw : []).slice(0, MAX_ROWS).map((r) => {
      // Links were checked at submit time; check again so a bad row can never render an unsafe href.
      const link = r.link ? allowedLink(r.link) ?? undefined : undefined;
      return {
        song: r.song,
        artist: r.artist,
        verdict: r.verdict,
        ...(r.note ? { note: r.note } : {}),
        ...(link ? { link } : {}),
        ...(r.earliest ? { earliest: r.earliest } : {}),
      };
    });
    cache.set(month, { at: Date.now(), rows });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return rows;
  } catch {
    return [];
  }
}
