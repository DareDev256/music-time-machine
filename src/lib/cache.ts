interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Normalize a cache key to prevent cache poisoning.
 *
 * Without normalization, visually identical strings with different byte
 * representations (unicode normalization forms, zero-width chars, control
 * chars) could map to separate cache slots — letting an attacker poison the
 * cache or bypass it entirely. NFC normalization + control char stripping
 * ensures one canonical key per logical value.
 */
function normalizeKey(key: string): string {
  return key
    .normalize("NFC")
    .replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200F\uFEFF]/g, "");
}

class TTLCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const nKey = normalizeKey(key);
    const entry = this.cache.get(nKey);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(nKey);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const nKey = normalizeKey(key);
    // Only evict when inserting a NEW key at capacity.
    // Updating an existing key doesn't grow the Map, so eviction would
    // needlessly destroy a valid unrelated entry (silent cache miss bug).
    if (!this.cache.has(nKey) && this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(nKey, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(normalizeKey(key));
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /** Return observable stats for health reporting. */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.maxSize > 0 ? +(this.cache.size / this.maxSize).toFixed(3) : 0,
    };
  }
}

// 5 minute TTL for search results
export const searchCache = new TTLCache(200);
export const SEARCH_TTL = 5 * 60 * 1000;

// 30 minute TTL for song data
export const songCache = new TTLCache(100);
export const SONG_TTL = 30 * 60 * 1000;

export { TTLCache };
