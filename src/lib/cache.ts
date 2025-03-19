/**
 * Simple in-memory cache for high-frequency data
 * Only use this for data that needs sub-second access times
 * For everything else, use the service worker cache
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in milliseconds (default: 1 second)
   */
  set<T>(key: string, value: T, ttl: number = 1000): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Delete a specific key from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
}

// Export a singleton instance
export const cacheManager = new CacheManager(); 