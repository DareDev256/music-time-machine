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
