/**
 * Tiered caching system with stale-while-revalidate pattern
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  staleUntil?: number;
}

/**
 * Cache durations in milliseconds for different types of data
 */
export const CACHE_DURATIONS = {
  // Realtime data (stock, prices, order counts)
  REALTIME: {
    TTL: 3 * 1000,        // 3 seconds
    STALE: 7 * 1000       // 7 seconds stale time
  },
  // Semi-dynamic data (best sellers, featured collections)
  SEMI_DYNAMIC: {
    TTL: 30 * 1000,       // 30 seconds
    STALE: 60 * 1000      // 1 minute stale time
  },
  // Static data (collection details, product descriptions)
  STATIC: {
    TTL: 5 * 60 * 1000,   // 5 minutes
    STALE: 15 * 60 * 1000 // 15 minutes stale time
  }
};

// Storage keys
const STORAGE_KEY_PREFIX = 'storedot_cache_';
const STORAGE_META_KEY = 'storedot_cache_meta';

// Default max cache size (in entries)
const DEFAULT_MAX_CACHE_SIZE = 500;

// Default max storage size (in bytes)
const DEFAULT_MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private revalidationQueue = new Set<string>();
  private maxCacheSize: number;
  private maxStorageSize: number;
  private persistenceEnabled: boolean;
  private lruList: string[] = [];

  constructor(options: {
    maxCacheSize?: number;
    maxStorageSize?: number;
    persistenceEnabled?: boolean;
  } = {}) {
    this.maxCacheSize = options.maxCacheSize || DEFAULT_MAX_CACHE_SIZE;
    this.maxStorageSize = options.maxStorageSize || DEFAULT_MAX_STORAGE_SIZE;
    this.persistenceEnabled = options.persistenceEnabled !== false;
    
    // Load cache from localStorage on initialization
    if (this.persistenceEnabled) {
      this.loadFromStorage();
    }
  }

  /**
   * Get an item from cache
   * @returns Object with value (or null if not found) and flag indicating if revalidation is needed
   */
  get<T>(key: string): { value: T | null; needsRevalidation: boolean } {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    // Update LRU list
    this.updateLRU(key);
    
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
   * @param persist Whether to persist this item to storage (defaults to true for static data)
   */
  set<T>(key: string, value: T, ttl: number, staleTime?: number, persist?: boolean): void {
    const now = Date.now();
    
    // Check if we need to evict entries before adding a new one
    this.ensureCacheSize();
    
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      expiresAt: now + ttl,
      staleUntil: staleTime ? now + ttl + staleTime : undefined
    };
    
    // Add to in-memory cache
    this.cache.set(key, entry);
    
    // Update LRU list
    this.updateLRU(key);
    
    // Determine if this entry should be persisted
    const shouldPersist = persist ?? this.shouldPersistKey(key, ttl);
    
    // Persist to localStorage if enabled and appropriate
    if (this.persistenceEnabled && shouldPersist) {
      this.saveEntryToStorage(key, entry);
    }
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
    this.removeFromLRU(key);
    
    // Remove from localStorage if persistence is enabled
    if (this.persistenceEnabled) {
      try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + key);
        this.updateStorageMeta();
      } catch (err) {
        console.error('Error removing item from localStorage:', err);
      }
    }
  }

  /**
   * Clear all cache entries with a specific prefix
   */
  invalidateByPrefix(prefix: string): void {
    const keysToRemove: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove from in-memory cache and LRU
    keysToRemove.forEach(key => {
      this.cache.delete(key);
      this.removeFromLRU(key);
    });
    
    // Remove from localStorage if persistence is enabled
    if (this.persistenceEnabled && keysToRemove.length > 0) {
      try {
        keysToRemove.forEach(key => {
          localStorage.removeItem(STORAGE_KEY_PREFIX + key);
        });
        this.updateStorageMeta();
      } catch (err) {
        console.error('Error removing items from localStorage:', err);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.lruList = [];
    
    // Clear localStorage if persistence is enabled
    if (this.persistenceEnabled) {
      try {
        // Get all localStorage keys that start with our prefix
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        
        // Remove all matching keys
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear meta
        localStorage.removeItem(STORAGE_META_KEY);
      } catch (err) {
        console.error('Error clearing localStorage cache:', err);
      }
    }
  }

  /**
   * Update the LRU list when an item is accessed
   */
  private updateLRU(key: string): void {
    // Remove key if it already exists in the list
    this.removeFromLRU(key);
    
    // Add key to the front of the list (most recently used)
    this.lruList.unshift(key);
  }

  /**
   * Remove a key from the LRU list
   */
  private removeFromLRU(key: string): void {
    const index = this.lruList.indexOf(key);
    if (index !== -1) {
      this.lruList.splice(index, 1);
    }
  }

  /**
   * Ensure the cache doesn't exceed the maximum size
   */
  private ensureCacheSize(): void {
    // Check if we need to evict entries
    while (this.cache.size >= this.maxCacheSize && this.lruList.length > 0) {
      // Get the least recently used key
      const lruKey = this.lruList.pop();
      if (lruKey) {
        // Remove from cache
        this.cache.delete(lruKey);
        
        // Remove from localStorage if persistence is enabled
        if (this.persistenceEnabled) {
          try {
            localStorage.removeItem(STORAGE_KEY_PREFIX + lruKey);
          } catch (err) {
            console.error('Error removing item from localStorage:', err);
          }
        }
      }
    }
  }

  /**
   * Determine if a key should be persisted to storage based on its type
   */
  private shouldPersistKey(key: string, ttl: number): boolean {
    // Only persist static and semi-dynamic data
    if (ttl <= CACHE_DURATIONS.REALTIME.TTL) {
      return false; // Don't persist realtime data
    }
    
    // Don't persist certain types of data
    if (key.includes('order_stats:') || key.includes('product_stock:') || key.includes('product_price:')) {
      return false;
    }
    
    return true;
  }

  /**
   * Save an entry to localStorage
   */
  private saveEntryToStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      const storageKey = STORAGE_KEY_PREFIX + key;
      
      // Serialize the entry
      const serialized = JSON.stringify(entry);
      
      // Check if this would exceed storage limits
      if (serialized.length > this.maxStorageSize) {
        console.warn(`Cache entry for ${key} exceeds max storage size, not persisting`);
        return;
      }
      
      // Store the entry
      localStorage.setItem(storageKey, serialized);
      
      // Update meta information
      this.updateStorageMeta();
    } catch (err) {
      // Handle quota exceeded or other storage errors
      console.error('Error saving to localStorage:', err);
      
      // If we hit storage limits, clear older entries
      if (err instanceof DOMException && (
        err.name === 'QuotaExceededError' || 
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        this.pruneStorage();
      }
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Get all localStorage keys that start with our prefix
      const cacheKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          cacheKeys.push(key);
        }
      }
      
      // Load each entry
      cacheKeys.forEach(storageKey => {
        try {
          const serialized = localStorage.getItem(storageKey);
          if (serialized) {
            const entry = JSON.parse(serialized) as CacheEntry<any>;
            const cacheKey = storageKey.substring(STORAGE_KEY_PREFIX.length);
            
            // Only load non-expired entries
            const now = Date.now();
            if (entry.staleUntil && now < entry.staleUntil) {
              this.cache.set(cacheKey, entry);
              this.lruList.push(cacheKey);
            } else if (now < entry.expiresAt) {
              this.cache.set(cacheKey, entry);
              this.lruList.push(cacheKey);
            } else {
              // Remove expired entries
              localStorage.removeItem(storageKey);
            }
          }
        } catch (parseErr) {
          console.error(`Error parsing cache entry ${storageKey}:`, parseErr);
          localStorage.removeItem(storageKey);
        }
      });
      
      console.log(`Loaded ${this.cache.size} entries from localStorage`);
    } catch (err) {
      console.error('Error loading cache from localStorage:', err);
    }
  }

  /**
   * Update storage metadata
   */
  private updateStorageMeta(): void {
    try {
      const meta = {
        lastUpdated: Date.now(),
        entryCount: this.getStorageEntryCount()
      };
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    } catch (err) {
      console.error('Error updating storage meta:', err);
    }
  }

  /**
   * Get the number of cache entries in localStorage
   */
  private getStorageEntryCount(): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Prune storage when we hit quota limits
   */
  private pruneStorage(): void {
    try {
      // Get all cache keys from localStorage
      const cacheKeys: { key: string; timestamp: number }[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(STORAGE_KEY_PREFIX)) {
          try {
            const serialized = localStorage.getItem(storageKey);
            if (serialized) {
              const entry = JSON.parse(serialized) as CacheEntry<any>;
              cacheKeys.push({
                key: storageKey,
                timestamp: entry.timestamp
              });
            }
          } catch (parseErr) {
            // If we can't parse it, remove it
            localStorage.removeItem(storageKey);
          }
        }
      }
      
      // Sort by timestamp (oldest first)
      cacheKeys.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove the oldest 25% of entries
      const removeCount = Math.ceil(cacheKeys.length * 0.25);
      for (let i = 0; i < removeCount && i < cacheKeys.length; i++) {
        localStorage.removeItem(cacheKeys[i].key);
      }
      
      console.log(`Pruned ${removeCount} old entries from localStorage`);
      
      // Update meta
      this.updateStorageMeta();
    } catch (err) {
      console.error('Error pruning localStorage:', err);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryEntryCount: number;
    storageEntryCount: number;
    lruListSize: number;
  } {
    return {
      memoryEntryCount: this.cache.size,
      storageEntryCount: this.persistenceEnabled ? this.getStorageEntryCount() : 0,
      lruListSize: this.lruList.length
    };
  }

  /**
   * Get all cache keys that match a specific prefix
   */
  getKeysByPrefix(prefix: string): string[] {
    const matchingKeys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.push(key);
      }
    }
    
    return matchingKeys;
  }
}

// Create a singleton instance with default options
export const cacheManager = new CacheManager();

/**
 * Set up realtime invalidation for cache entries based on Supabase events
 */
export function setupRealtimeInvalidation(supabase: any) {
  // Listen for stock/price changes
  supabase.channel('product_changes')
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'products'
      },
      (payload: any) => {
        const productId = payload.new?.id || payload.old?.id;
        if (productId) {
          // Check if price or stock changed
          if (
            payload.new?.price !== payload.old?.price ||
            payload.new?.quantity !== payload.old?.quantity
          ) {
            // Invalidate bestsellers cache
            cacheManager.invalidateByPrefix('bestsellers:');
            
            // Invalidate specific product dynamic data
            cacheManager.invalidate(`product_dynamic:${productId}`);
            cacheManager.invalidate(`product_stock:${productId}`);
            cacheManager.invalidate(`product_price:${productId}`);
          }
        }
      }
    )
    .subscribe();
    
  // Listen for order changes (affects stock and bestsellers)
  supabase.channel('order_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload: any) => {
        const productId = payload.new?.product_id || payload.old?.product_id;
        if (productId) {
          // Invalidate order stats
          cacheManager.invalidate(`order_stats:${productId}`);
          
          // Invalidate bestsellers
          cacheManager.invalidateByPrefix('bestsellers:');
          
          // Invalidate product stock (since orders affect stock)
          cacheManager.invalidate(`product_stock:${productId}`);
        }
      }
    )
    .subscribe();
} 