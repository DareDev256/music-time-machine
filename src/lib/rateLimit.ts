interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
}

const buckets = new Map<string, RateLimitBucket>();

// Evict stale buckets every 5 minutes to prevent unbounded memory growth
// from unique per-IP keys accumulating over time.
const EVICTION_INTERVAL_MS = 5 * 60_000;
const STALE_THRESHOLD_MS = 10 * 60_000; // Buckets idle >10 min are stale
let lastEviction = Date.now();

function evictStaleBuckets(): void {
  const now = Date.now();
  if (now - lastEviction < EVICTION_INTERVAL_MS) return;
  lastEviction = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_THRESHOLD_MS) {
      buckets.delete(key);
    }
  }
}

function getBucket(name: string, maxTokens: number, refillPeriodMs: number): RateLimitBucket {
  evictStaleBuckets();
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
  catalog: { maxTokens: 10, windowMs: 60_000 },  // 10 catalog fetches/min
} as const;

export type RouteName = keyof typeof ROUTE_LIMITS;

/**
 * IPv4: 1-3 digits × 4 octets. IPv6: hex groups with optional :: shorthand.
 * Rejects spoofed garbage like "fake-ip", "127.0.0.1 OR 1=1", etc.
 */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function isValidIp(ip: string): boolean {
  return IPV4_PATTERN.test(ip) || IPV6_PATTERN.test(ip);
}

/**
 * Extract the client IP from request headers with spoofing protection.
 *
 * Problem: `x-forwarded-for` is trivially spoofable by clients. An attacker
 * sending `X-Forwarded-For: random-string-{n}` on every request gets a fresh
 * rate limit bucket each time, completely bypassing per-IP rate limiting.
 *
 * Mitigation: Validate the extracted IP against IPv4/IPv6 format. Invalid IPs
 * fall back to "unknown-invalid", which funnels all spoofed requests into a
 * single shared rate limit bucket — making spoofing counterproductive.
 */
export function extractClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return isValidIp(ip) ? ip : "unknown-invalid";
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return isValidIp(realIp) ? realIp : "unknown-invalid";
  }
  return "unknown";
}

export function checkRouteLimit(route: RouteName, clientIp: string): boolean {
  const config = ROUTE_LIMITS[route];
  const key = `route:${route}:${clientIp}`;
  return tryConsume(key, config.maxTokens, config.windowMs);
}

export function rateLimitResponse(requestId?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Retry-After": "60",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
  };
  if (requestId) headers["X-Request-ID"] = requestId;
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    { status: 429, headers },
  );
}

// --- Shared input validation ---

const ID_PATTERN = /^[a-zA-Z0-9\-:]+$/;
const MAX_ID_LENGTH = 200;
const MAX_QUERY_LENGTH = 200;

/** Validate a resource ID (songs, artists, etc). Allows alphanumeric, dashes, colons. */
export function isValidId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_ID_LENGTH && ID_PATTERN.test(id);
}

/** Keys that could trigger prototype pollution if used in object bracket notation. */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Sanitize a user search query: strip null bytes, unicode control chars,
 *  HTML tags, dangerous chars, prototype pollution payloads, enforce max length.
 *
 *  Null bytes (\x00, %00) can truncate strings in C-backed parsers (e.g. path
 *  traversal via `photo\x00.js`). Unicode control chars (U+0000–U+001F,
 *  U+007F–U+009F) have no legitimate use in search queries and can confuse
 *  downstream text processing, log analysis, and WAF rules. */
export function sanitizeQuery(input: string): string {
  const cleaned = input
    // Strip null bytes and unicode control characters (C0, DEL, C1 ranges)
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'&]/g, "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);

  // Block prototype pollution: if the entire cleaned query is a dangerous
  // object key, reject it. Prevents use as object property in downstream code.
  if (DANGEROUS_KEYS.has(cleaned)) return "";

  return cleaned;
}
