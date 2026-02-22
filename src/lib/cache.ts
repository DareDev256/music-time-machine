interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class TTLCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
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
