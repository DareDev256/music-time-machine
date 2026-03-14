import { NextRequest, NextResponse } from "next/server";
import { searchCache, songCache } from "@/lib/cache";
import { isSpotifyConfigured } from "@/lib/spotify";
import { isYouTubeConfigured } from "@/lib/youtube";
import { isGeniusConfigured } from "@/lib/genius";
import { mockSongs } from "@/lib/mockData";
import { withRouteHandler } from "@/lib/apiHandler";

// ── Process-level counters (survive across requests in the same instance) ──
const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;

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
function resolveOverallStatus(statuses: readonly string[]): string {
  return statuses.reduce<{ weight: number; label: string }>(
    (worst, s) => {
      const severity = SEVERITY_WEIGHT[s] ?? SEVERITY_WEIGHT.pass;
      return severity.weight > worst.weight ? severity : worst;
    },
    { ...SEVERITY_WEIGHT.pass },
  ).label;
}

/** Increment the global error counter (call from other API routes). */
export function recordError(): void {
  errorCount++;
}

/**
<<<<<<< HEAD
<<<<<<< HEAD
 * Whether to redact internal diagnostics from the health response.
 *
 * In production, memory stats, error counts, and cache internals are
 * information disclosure risks (OWASP A01:2021). Attackers use memory
 * pressure data to time resource exhaustion attacks, error counts to
 * confirm fuzzing attempts are landing, and cache utilization to map
 * traffic patterns. Redacted in production; full output in development
 * for debugging convenience.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function GET(): Promise<NextResponse> {
=======
 * Health check — now rate-limited via withRouteHandler.
 *
 * Memory details (heap, rss, external) are only included when the request
 * provides a valid HEALTH_TOKEN query param matching the server-side env var.
 * This prevents unauthenticated recon of runtime memory patterns while
 * keeping the health endpoint useful for uptime monitoring.
 */
export const GET = withRouteHandler({ route: "health" }, async (request) => {
>>>>>>> passion/security-add-content-security-poli-mmmte429
=======
 * Verify the request carries a valid HEALTH_AUTH_TOKEN via Bearer header.
 *
 * Without this gate, unauthenticated users can read heap sizes, error rates,
 * cache utilization, uptime, and integration config — giving attackers a
 * detailed internal map of the running server (OWASP A01: Broken Access Control).
 *
 * When no HEALTH_AUTH_TOKEN env var is set, detailed diagnostics are simply
 * omitted — the public response is limited to status + version.
 */
function isAuthorizedForDetails(request: NextRequest): boolean {
  const token = process.env.HEALTH_AUTH_TOKEN;
  if (!token) return false; // No token configured = no detailed access

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  // Constant-time-ish comparison to prevent timing attacks on the token.
  // Length check first — Buffer operations require equal-length inputs.
  const provided = authHeader.slice(7);
  if (provided.length !== token.length) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.every((byte, i) => byte === b[i]);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
>>>>>>> passion/security-diversity-picked-securit-mmfmpsrw
  requestCount++;
  const now = Date.now();
  const uptimeMs = now - startedAt;

  // ── Snapshot cache stats once — avoids 6 redundant getStats() calls ──
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

<<<<<<< HEAD
<<<<<<< HEAD
  // ── Base response — always exposed (safe for public consumption) ────
  const response: Record<string, unknown> = {
=======
  // ── Build response (memory gated behind token) ────────────────────────
  const body: Record<string, unknown> = {
>>>>>>> passion/security-add-content-security-poli-mmmte429
    status,
    version: APP_VERSION,
    timestamp: new Date(now).toISOString(),
=======
  // ── Public response (safe for unauthenticated consumers) ─────────────
  // Only expose status + version. Memory, uptime, error counts, cache stats,
  // and integration config are server internals that aid reconnaissance.
  const publicPayload = {
    status,
    version: APP_VERSION,
    timestamp: new Date(now).toISOString(),
  };

  if (!isAuthorizedForDetails(request)) {
    return NextResponse.json(publicPayload);
  }

  // ── Detailed diagnostics (requires HEALTH_AUTH_TOKEN) ────────────────
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => +(bytes / 1_048_576).toFixed(1);

  return NextResponse.json({
    ...publicPayload,
>>>>>>> passion/security-diversity-picked-securit-mmfmpsrw
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs),
    },
    mode: useMockData ? "mock" : "live",
    integrations: { spotify, youtube, genius },
    checks,
  };

  // ── Diagnostics — redacted in production to prevent info disclosure ──
  if (!IS_PRODUCTION) {
    const mem = process.memoryUsage();
    const toMB = (bytes: number) => +(bytes / 1_048_576).toFixed(1);
    response.caches = { search: searchStats, song: songStats };
    response.metrics = {
      catalogSize: CATALOG_SIZE,
      apiRoutes: API_ROUTE_COUNT,
      requests: requestCount,
      errors: errorCount,
<<<<<<< HEAD
    };
    response.memory = {
=======
    },
  };

  // Gate memory details behind a shared secret — process.memoryUsage()
  // reveals heap pressure patterns useful for timing side-channels.
  const healthToken = process.env.HEALTH_TOKEN;
  const providedToken = request.nextUrl.searchParams.get("token");
  if (healthToken && providedToken === healthToken) {
    const mem = process.memoryUsage();
    const toMB = (bytes: number) => +(bytes / 1_048_576).toFixed(1);
    body.memory = {
>>>>>>> passion/security-add-content-security-poli-mmmte429
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
      external: toMB(mem.external),
      unit: "MB",
    };
  }

<<<<<<< HEAD
  return NextResponse.json(response);
}
=======
  return NextResponse.json(body);
});
>>>>>>> passion/security-add-content-security-poli-mmmte429

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
