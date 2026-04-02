import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { searchCache, songCache } from "@/lib/cache";
import { getErrorCount } from "@/lib/apiHandler";
import { isSpotifyConfigured } from "@/lib/spotify";
import { isYouTubeConfigured } from "@/lib/youtube";
import { isGeniusConfigured } from "@/lib/genius";
import { mockSongs } from "@/lib/mockData";
import { extractClientIp, tryConsume } from "@/lib/rateLimit";

// ── Process-level counters (survive across requests in the same instance) ──
const startedAt = Date.now();
let requestCount = 0;

/** Version from package.json, injected at build time via next.config.ts. */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

/** Number of API route files — updated when routes are added/removed. */
const API_ROUTE_COUNT = 7;

/**
 * Static catalog size — mockSongs is a frozen import that never changes
 * at runtime. Computing Object.keys() once avoids allocating a throwaway
 * string array on every health check request.
 */
const CATALOG_SIZE = Object.keys(mockSongs).length;

export const dynamic = "force-dynamic"; // Never cache health checks

/**
 * Weight map for check statuses — higher weight = more severe.
 * Extensible: add "critical" or "degraded" without touching the resolution logic.
 */
const SEVERITY_WEIGHT: Record<string, { weight: number; label: string }> = {
  fail: { weight: 2, label: "unhealthy" },
  warn: { weight: 1, label: "degraded" },
  pass: { weight: 0, label: "healthy" },
} as const;

/** Resolve the worst severity across a set of check statuses. */
export function resolveOverallStatus(statuses: readonly string[]): string {
  return statuses.reduce<{ weight: number; label: string }>(
    (worst, s) => {
      const severity = SEVERITY_WEIGHT[s] ?? SEVERITY_WEIGHT.pass;
      return severity.weight > worst.weight ? severity : worst;
    },
    { ...SEVERITY_WEIGHT.pass },
  ).label;
}

/**
 * Verify the request carries a valid HEALTH_AUTH_TOKEN via Bearer header.
 *
 * Without this gate, unauthenticated users can read heap sizes, error rates,
 * cache utilization, uptime, and integration config — giving attackers a
 * detailed internal map of the running server (OWASP A01: Broken Access Control).
 *
 * When no HEALTH_AUTH_TOKEN env var is set, detailed diagnostics are simply
 * omitted — the public response is limited to status + version.
 */
export function isAuthorizedForDetails(request: NextRequest): boolean {
  const token = process.env.HEALTH_AUTH_TOKEN;
  if (!token) return false; // No token configured = no detailed access

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  // Constant-time comparison via Node.js crypto to prevent timing attacks.
  // Length check first — timingSafeEqual requires equal-length buffers.
  const provided = authHeader.slice(7);
  if (provided.length !== token.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(token));
}

/**
 * Security headers for health responses. This route doesn't use
 * withRouteHandler() (it needs access to process-level counters),
 * so headers are applied manually.
 */
const HEALTH_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Rate limit: 30 health checks/min per IP ────────────────────────
  const clientIp = extractClientIp(request);
  if (!tryConsume(`route:health:${clientIp}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { ...HEALTH_HEADERS, "Retry-After": "60" } }
    );
  }

  requestCount++;
  const now = Date.now();
  const uptimeMs = now - startedAt;

  // ── Snapshot cache stats once ──────────────────────────────────────
  const searchStats = searchCache.getStats();
  const songStats = songCache.getStats();

  // ── Per-subsystem health checks ──────────────────────────────────────
  const spotify = isSpotifyConfigured();
  const youtube = isYouTubeConfigured();
  const genius = isGeniusConfigured();
  const configuredCount = +spotify + +youtube + +genius;
  const useMockData = process.env.USE_MOCK_DATA === "true";

  const checks = [
    {
      name: "catalog",
      status: CATALOG_SIZE > 0 ? "pass" : "fail",
      detail: `${CATALOG_SIZE} songs loaded`,
    },
    {
      name: "cache:search",
      status: "pass" as const,
      detail: `${searchStats.size}/${searchStats.maxSize} entries`,
    },
    {
      name: "cache:song",
      status: "pass" as const,
      detail: `${songStats.size}/${songStats.maxSize} entries`,
    },
    {
      name: "integrations",
      status: useMockData || configuredCount > 0 ? "pass" : "warn",
      detail: useMockData
        ? "mock mode (no APIs required)"
        : `${configuredCount}/3 configured`,
    },
  ] as const;

  const status = resolveOverallStatus(checks.map((c) => c.status));

  // ── Public response (safe for unauthenticated consumers) ─────────────
  const publicPayload = {
    status,
    version: APP_VERSION,
    timestamp: new Date(now).toISOString(),
  };

  if (!isAuthorizedForDetails(request)) {
    return NextResponse.json(publicPayload, { headers: HEALTH_HEADERS });
  }

  // ── Detailed diagnostics (requires HEALTH_AUTH_TOKEN) ────────────────
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => +(bytes / 1_048_576).toFixed(1);

  return NextResponse.json(
    {
      ...publicPayload,
      uptime: {
        ms: uptimeMs,
        human: formatUptime(uptimeMs),
      },
      mode: useMockData ? "mock" : "live",
      integrations: { spotify, youtube, genius },
      checks,
      caches: { search: searchStats, song: songStats },
      metrics: {
        catalogSize: CATALOG_SIZE,
        apiRoutes: API_ROUTE_COUNT,
        requests: requestCount,
        errors: getErrorCount(),
      },
      memory: {
        rss: toMB(mem.rss),
        heapUsed: toMB(mem.heapUsed),
        heapTotal: toMB(mem.heapTotal),
        external: toMB(mem.external),
        unit: "MB",
      },
    },
    { headers: HEALTH_HEADERS }
  );
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
