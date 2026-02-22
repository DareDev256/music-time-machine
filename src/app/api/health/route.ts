import { NextResponse } from "next/server";
import { searchCache, songCache } from "@/lib/cache";
import { isSpotifyConfigured } from "@/lib/spotify";
import { isYouTubeConfigured } from "@/lib/youtube";
import { isGeniusConfigured } from "@/lib/genius";

// Captured once at module load — survives across requests in the same process.
const startedAt = Date.now();

/** Version from package.json, injected at build time via next.config.ts. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

export const dynamic = "force-dynamic"; // Never cache health checks

export async function GET(): Promise<NextResponse> {
  const now = Date.now();
  const uptimeMs = now - startedAt;

  const integrations = {
    spotify: isSpotifyConfigured(),
    youtube: isYouTubeConfigured(),
    genius: isGeniusConfigured(),
  };

  const configuredCount = Object.values(integrations).filter(Boolean).length;
  const useMockData = process.env.USE_MOCK_DATA === "true";

  // Determine overall status:
  // - "healthy": mock mode OR at least 1 real integration configured
  // - "degraded": real mode but zero integrations (falls back to mock anyway)
  const status = useMockData || configuredCount > 0 ? "healthy" : "degraded";

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
    caches: {
      search: searchCache.getStats(),
      song: songCache.getStats(),
    },
    metrics: {
      catalogSize: 18,       // Curated mock songs
      apiRoutes: 7,          // Including this health route
      testCount: 261,        // Tracked manually — bumped with test additions
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
