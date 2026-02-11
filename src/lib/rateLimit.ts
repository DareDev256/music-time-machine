interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
}

const buckets = new Map<string, RateLimitBucket>();

function getBucket(name: string, maxTokens: number, refillPeriodMs: number): RateLimitBucket {
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = {
      tokens: maxTokens,
      lastRefill: Date.now(),
      maxTokens,
      refillRate: maxTokens / refillPeriodMs,
    };
    buckets.set(name, bucket);
  }
  return bucket;
}

function refill(bucket: RateLimitBucket): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;
}

export function tryConsume(name: string, maxTokens: number, refillPeriodMs: number): boolean {
  const bucket = getBucket(name, maxTokens, refillPeriodMs);
  refill(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

// Pre-configured rate limiters for each API
export function checkSpotifyLimit(): boolean {
  return tryConsume("spotify", 30, 30_000); // 30 requests per 30s
}

export function checkYouTubeLimit(): boolean {
  return tryConsume("youtube", 100, 3_600_000); // 100 requests per hour
}

export function checkGeniusLimit(): boolean {
  return tryConsume("genius", 50, 60_000); // 50 requests per minute
}

// --- API route-level rate limiting (per-IP) ---

const ROUTE_LIMITS = {
  search: { maxTokens: 20, windowMs: 60_000 },   // 20 searches/min
  song: { maxTokens: 30, windowMs: 60_000 },      // 30 lookups/min
  compare: { maxTokens: 15, windowMs: 60_000 },   // 15 comparisons/min
  artist: { maxTokens: 30, windowMs: 60_000 },    // 30 lookups/min
  og: { maxTokens: 10, windowMs: 60_000 },        // 10 OG images/min
} as const;

export type RouteName = keyof typeof ROUTE_LIMITS;

export function extractClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}

export function checkRouteLimit(route: RouteName, clientIp: string): boolean {
  const config = ROUTE_LIMITS[route];
  const key = `route:${route}:${clientIp}`;
  return tryConsume(key, config.maxTokens, config.windowMs);
}

export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    }
  );
}
