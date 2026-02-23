import { NextResponse } from "next/server";
import { searchCache, songCache } from "@/lib/cache";
import { isSpotifyConfigured } from "@/lib/spotify";
import { isYouTubeConfigured } from "@/lib/youtube";
import { isGeniusConfigured } from "@/lib/genius";
import { mockSongs } from "@/lib/mockData";

// ── Process-level counters (survive across requests in the same instance) ──
const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;

/** Version from package.json, injected at build time via next.config.ts. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

/** Number of API route files — updated when routes are added/removed. */
const API_ROUTE_COUNT = 7;

export const dynamic = "force-dynamic"; // Never cache health checks

/** Increment the global error counter (call from other API routes). */
export function recordError(): void {
  errorCount++;
}

export async function GET(): Promise<NextResponse> {
  requestCount++;
  const now = Date.now();
  const uptimeMs = now - startedAt;

  // ── Per-subsystem health checks ──────────────────────────────────────
  const integrations = {
    spotify: isSpotifyConfigured(),
    youtube: isYouTubeConfigured(),
    genius: isGeniusConfigured(),
  };

  const configuredCount = Object.values(integrations).filter(Boolean).length;
  const useMockData = process.env.USE_MOCK_DATA === "true";
  const catalogSize = Object.keys(mockSongs).length;

  const checks = [
    {
      name: "catalog",
      status: catalogSize > 0 ? "pass" : "fail",
      detail: `${catalogSize} songs loaded`,
    },
    {
      name: "cache:search",
      status: "pass" as const,
      detail: `${searchCache.getStats().size}/${searchCache.getStats().maxSize} entries`,
    },
    {
      name: "cache:song",
      status: "pass" as const,
      detail: `${songCache.getStats().size}/${songCache.getStats().maxSize} entries`,
    },
    {
      name: "integrations",
      status: useMockData || configuredCount > 0 ? "pass" : "warn",
      detail: useMockData
        ? "mock mode (no APIs required)"
        : `${configuredCount}/3 configured`,
    },
  ] as const;

  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");
  const status = hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  // ── Memory snapshot (MB, 1 decimal) ──────────────────────────────────
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => +(bytes / 1_048_576).toFixed(1);

  return NextResponse.json({
    status,
    version: APP_VERSION,
    timestamp: new Date(now).toISOString(),
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs),
    },
    mode: useMockData ? "mock" : "live",
    integrations,
    checks,
    caches: {
      search: searchCache.getStats(),
      song: songCache.getStats(),
    },
    metrics: {
      catalogSize,
      apiRoutes: API_ROUTE_COUNT,
      requests: requestCount,
      errors: errorCount,
    },
    memory: {
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
      external: toMB(mem.external),
      unit: "MB",
    },
  });
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
