import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// GET /api/health — what data the site is serving and how old it is.
// A shard that is missing or stale turns the status to "degraded", so an outside probe
// (or the weekly refresh job) can tell a healthy deploy from one serving last month.

export const dynamic = "force-dynamic";

const ERA = path.join(process.cwd(), "public", "era");
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
const CHART_STALE_DAYS = 14; // Billboard publishes weekly; two missed weeks means the refresh is broken.
// YouTube counts are refreshed weekly and must not be shown past 30 days (API policy; the page hides them itself).
// Two missed refreshes turn health red with 16 days left to fix it.
const YOUTUBE_STALE_DAYS = 14;

async function json<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(ERA, file), "utf8")) as T;
  } catch {
    return null;
  }
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}

export async function GET() {
  const flight = await json<{ through?: string; songs?: { art: string | null }[] }>("flight.json");
  const lanes = await json<{ lanes?: { lane: string; through?: string }[] }>("lanes/index.json");
  const heatMonths = await readdir(path.join(ERA, "heat")).then(
    (f) => f.filter((n) => /^\d{4}-\d{2}\.json$/.test(n)).length,
    () => 0,
  );

  // The crawl is live once its index exists; from then on, no month files (deleted as stale) is a failure too.
  const ytBuilt = (await json<unknown>("youtube/index.json")) !== null;
  const ytFiles = ytBuilt
    ? await readdir(path.join(ERA, "youtube")).then((f) => f.filter((n) => /^\d{4}-\d{2}\.json$/.test(n)), () => [] as string[])
    : [];
  const ytDates = (await Promise.all(ytFiles.map((f) => json<{ viewsAsOf?: string }>(`youtube/${f}`)))).map((d) => d?.viewsAsOf ?? "");
  const ytOldest = ytDates.length ? [...ytDates].sort()[0] || null : null;
  const ytAge = daysSince(ytOldest);

  const chartAge = daysSince(flight?.through);
  const coversResolved = flight?.songs?.filter((s) => s.art).length ?? 0;
  const checks = {
    charts: { through: flight?.through ?? null, ageDays: chartAge, ok: chartAge !== null && chartAge <= CHART_STALE_DAYS },
    covers: { resolved: coversResolved, total: flight?.songs?.length ?? 0, ok: coversResolved > 0 },
    lanes: { passing: lanes?.lanes?.map((l) => l.lane) ?? [], ok: (lanes?.lanes?.length ?? 0) > 0 },
    offCharts: { months: heatMonths, ok: heatMonths > 0 },
    youtube: ytBuilt
      ? { months: ytFiles.length, oldestCounts: ytOldest, ageDays: ytAge, ok: ytFiles.length > 0 && ytAge !== null && ytAge <= YOUTUBE_STALE_DAYS }
      : { months: 0, state: "not built", ok: true },
  };
  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: ok ? "healthy" : "degraded", version: APP_VERSION, checkedAt: new Date().toISOString(), checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
