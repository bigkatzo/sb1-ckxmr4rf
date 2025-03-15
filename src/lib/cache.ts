/**
 * Tiered caching system with stale-while-revalidate pattern
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  staleUntil?: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private revalidationQueue = new Set<string>();

  /**
   * Get an item from cache
   * @returns Object with value (or null if not found) and flag indicating if revalidation is needed
   */
  get<T>(key: string): { value: T | null; needsRevalidation: boolean } {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    if (!entry) {
      return { value: null, needsRevalidation: true };
    }
    
    // Fresh cache hit
    if (now < entry.expiresAt) {
      return { value: entry.value, needsRevalidation: false };
    }
    
    // Stale but still usable
    if (entry.staleUntil && now < entry.staleUntil) {
      return { value: entry.value, needsRevalidation: true };
    }
    
    // Expired
    return { value: null, needsRevalidation: true };
  }

  /**
   * Set an item in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in milliseconds
   * @param staleTime Additional time the value can be used while revalidating
   */
  set<T>(key: string, value: T, ttl: number, staleTime?: number): void {
    const now = Date.now();
    
    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + ttl,
      staleUntil: staleTime ? now + ttl + staleTime : undefined
    });
  }

  /**
   * Mark a key as being revalidated
   */
  markRevalidating(key: string): void {
    this.revalidationQueue.add(key);
  }

  /**
   * Unmark a key as being revalidated
   */
  unmarkRevalidating(key: string): void {
    this.revalidationQueue.delete(key);
  }

  /**
   * Check if a key is being revalidated
   */
  isRevalidating(key: string): boolean {
    return this.revalidationQueue.has(key);
  }

  /**
   * Clear a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries with a specific prefix
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Create a singleton instance
export const cacheManager = new CacheManager(); 