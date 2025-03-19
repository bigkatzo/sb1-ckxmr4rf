/**
 * Enterprise-Grade Tiered Caching System
 * Implements advanced caching strategies with performance optimizations
 * 
 * Features:
 * - Multi-level caching (Memory -> IndexedDB -> Network)
 * - Intelligent prefetching and background sync
 * - Device-aware optimizations
 * - Atomic operations with distributed locking
 * - Real-time cache invalidation with WebSocket support
 * - Comprehensive metrics and monitoring
 * - Smart garbage collection
 */

import { type IDBPDatabase, openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  staleUntil?: number;
  version?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  latency: number[];
  size: number;
  lastAccess: number;
}

/**
 * Cache durations optimized for e-commerce and blockchain data
 */
export const CACHE_DURATIONS = {
  // Real-time data (stock levels, prices, order status)
  REALTIME: {
    TTL: 3 * 1000,         // 3 seconds
    STALE: 7 * 1000,       // 7 seconds stale time
    PRIORITY: 1            // Highest priority
  },
  // Semi-dynamic data (bestsellers, featured items)
  SEMI_DYNAMIC: {
    TTL: 30 * 1000,        // 30 seconds
    STALE: 60 * 1000,      // 1 minute stale time
    PRIORITY: 2
  },
  // Product data (descriptions, images, metadata)
  PRODUCT: {
    TTL: 5 * 60 * 1000,    // 5 minutes
    STALE: 15 * 60 * 1000, // 15 minutes stale time
    PRIORITY: 3
  },
  // NFT and blockchain data
  BLOCKCHAIN: {
    TTL: 60 * 60 * 1000,   // 1 hour
    STALE: 2 * 60 * 60 * 1000, // 2 hours stale time
    PRIORITY: 4
  },
  // Static content (collection details, categories)
  STATIC: {
    TTL: 24 * 60 * 60 * 1000,  // 24 hours
    STALE: 7 * 24 * 60 * 60 * 1000, // 7 days stale time
    PRIORITY: 5
  }
};

// Memory thresholds for dynamic cache sizing
const MEMORY_THRESHOLDS = {
  LOW: 100 * 1024 * 1024,    // 100MB
  CRITICAL: 50 * 1024 * 1024, // 50MB
  DEFAULT_DEVICE_MEMORY: 4    // 4GB
};

// Cache size limits with auto-scaling
const getDefaultCacheLimits = (deviceMemory = MEMORY_THRESHOLDS.DEFAULT_DEVICE_MEMORY) => {
  const memoryFactor = Math.max(0.5, Math.min(deviceMemory / 4, 2)); // Scale between 0.5x and 2x
  
  return {
    MEMORY_ENTRIES: Math.floor(1000 * memoryFactor),
    INDEXED_DB_SIZE: Math.floor(50 * 1024 * 1024 * memoryFactor), // 50MB base
    BATCH_SIZE: Math.floor(50 * memoryFactor),
    MAX_PRIORITY_ENTRIES: Math.floor(200 * memoryFactor)
  };
};

export class EnhancedCacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private db: IDBPDatabase | null = null;
  private metrics: Map<string, CacheMetrics>;
  private locks: Map<string, Promise<void>>;
  private prefetchQueue: Set<string>;
  private websocket: WebSocket | null = null;
  private cacheLimits: ReturnType<typeof getDefaultCacheLimits>;
  private garbageCollector: NodeJS.Timeout | null = null;

  constructor(options: {
    websocketUrl?: string;
    enableMetrics?: boolean;
    enablePrefetch?: boolean;
    customLimits?: Partial<ReturnType<typeof getDefaultCacheLimits>>;
  } = {}) {
    this.memoryCache = new Map();
    this.metrics = new Map();
    this.locks = new Map();
    this.prefetchQueue = new Set();
    
    // Initialize cache limits based on device memory
    const deviceMemory = (navigator as any).deviceMemory || MEMORY_THRESHOLDS.DEFAULT_DEVICE_MEMORY;
    this.cacheLimits = {
      ...getDefaultCacheLimits(deviceMemory),
      ...options.customLimits
    };

    // Initialize IndexedDB
    this.initializeDB();

    // Setup WebSocket for real-time invalidation if URL provided
    if (options.websocketUrl) {
      this.initializeWebSocket(options.websocketUrl);
    }

    // Start garbage collector
    this.initializeGarbageCollector();

    // Initialize performance observer
    if (options.enableMetrics) {
      this.initializePerformanceObserver();
    }
  }

  /**
   * Initialize IndexedDB for persistent storage
   */
  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB('enhanced-cache', 1, {
        upgrade(db: IDBPDatabase) {
          if (!db.objectStoreNames.contains('cache-store')) {
            db.createObjectStore('cache-store');
          }
        }
      });
    } catch (err) {
      console.error('Failed to initialize IndexedDB:', err);
    }
  }

  /**
   * Initialize WebSocket connection for real-time cache invalidation
   */
  private initializeWebSocket(url: string | undefined): void {
    if (!url) {
      console.warn('WebSocket URL not provided, skipping real-time cache invalidation');
      return;
    }
    
    try {
      this.websocket = new WebSocket(url);
      
      this.websocket.onopen = () => {
        console.log('Cache invalidation WebSocket connected');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const { type, keys } = JSON.parse(event.data);
          if (type === 'invalidate' && Array.isArray(keys)) {
            keys.forEach(key => this.invalidateKey(key));
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      // Reconnection logic with exponential backoff
      let reconnectAttempts = 0;
      const maxReconnectDelay = 30000; // 30 seconds
      
      this.websocket.onclose = () => {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
        console.log(`WebSocket disconnected, attempting to reconnect in ${delay}ms`);
        
        setTimeout(() => {
          reconnectAttempts++;
          this.initializeWebSocket(url);
        }, delay);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Initialize garbage collector for automatic cache cleanup
   */
  private initializeGarbageCollector(): void {
    const gcInterval = 5 * 60 * 1000; // 5 minutes
    
    this.garbageCollector = setInterval(() => {
      this.runGarbageCollection();
    }, gcInterval);
  }

  /**
   * Initialize PerformanceObserver for monitoring
   */
  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            this.updateMetrics(entry);
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * Get an item from cache with smart fallback strategy
   */
  async get<T>(key: string, options: {
    forceFresh?: boolean;
    priority?: number;
    context?: Record<string, any>;
  } = {}): Promise<{ value: T | null; needsRevalidation: boolean; metadata?: Record<string, any> }> {
    const startTime = performance.now();
    
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && !options.forceFresh) {
        const now = Date.now();
        
        // Update metrics
        this.recordMetric(key, 'hit', performance.now() - startTime);
        
        // Fresh cache hit
        if (now < memoryEntry.expiresAt) {
          return {
            value: memoryEntry.value,
            needsRevalidation: false,
            metadata: memoryEntry.metadata
          };
        }
        
        // Stale but usable
        if (memoryEntry.staleUntil && now < memoryEntry.staleUntil) {
          // Trigger background revalidation
          this.prefetchQueue.add(key);
          this.processPrefetchQueue();
          
          return {
            value: memoryEntry.value,
            needsRevalidation: true,
            metadata: memoryEntry.metadata
          };
        }
      }

      // Try IndexedDB if available
      if (this.db) {
        const idbEntry = await this.db.get('cache-store', key) as CacheEntry<T> | undefined;
        if (idbEntry && !options.forceFresh) {
          const now = Date.now();
          
          // Move to memory cache if within limits
          if (this.memoryCache.size < this.cacheLimits.MEMORY_ENTRIES) {
            this.memoryCache.set(key, idbEntry);
          }
          
          // Fresh cache hit
          if (now < idbEntry.expiresAt) {
            return {
              value: idbEntry.value,
              needsRevalidation: false,
              metadata: idbEntry.metadata
            };
          }
          
          // Stale but usable
          if (idbEntry.staleUntil && now < idbEntry.staleUntil) {
            this.prefetchQueue.add(key);
            this.processPrefetchQueue();
            
            return {
              value: idbEntry.value,
              needsRevalidation: true,
              metadata: idbEntry.metadata
            };
          }
        }
      }

      // No cache hit or force fresh
      this.recordMetric(key, 'miss', performance.now() - startTime);
      return { value: null, needsRevalidation: true };
      
    } catch (err) {
      console.error('Cache get error:', err);
      this.recordMetric(key, 'error', performance.now() - startTime);
      return { value: null, needsRevalidation: true };
    }
  }

  /**
   * Set an item in cache with atomic operations
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number,
    options: {
      staleTime?: number;
      priority?: number;
      metadata?: Record<string, any>;
      persist?: boolean;
    } = {}
  ): Promise<void> {
    const release = await this.acquireLock(key);
    
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        expiresAt: now + ttl,
        staleUntil: options.staleTime ? now + ttl + options.staleTime : undefined,
        version: uuidv4(),
        priority: options.priority,
        metadata: options.metadata
      };

      // Update memory cache
      this.memoryCache.set(key, entry);
      
      // Ensure we don't exceed memory limits
      await this.ensureCacheSize();
      
      // Update IndexedDB if persistence is enabled
      if (options.persist !== false && this.db) {
        await this.db.put('cache-store', entry, key);
      }
      
      // Notify other tabs/windows about the update
      this.broadcastUpdate(key, entry.version);
      
    } finally {
      release();
    }
  }

  /**
   * Acquire a distributed lock for atomic operations
   */
  private async acquireLock(key: string, timeout = 5000): Promise<() => void> {
    const lockKey = `lock:${key}`;
    
    if (this.locks.has(lockKey)) {
      await this.locks.get(lockKey);
    }
    
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = () => {
        this.locks.delete(lockKey);
        resolve();
      };
    });
    
    this.locks.set(lockKey, lockPromise);
    
    // Auto-release lock after timeout
    setTimeout(() => {
      if (this.locks.get(lockKey) === lockPromise) {
        releaseLock!();
      }
    }, timeout);
    
    return releaseLock!;
  }

  /**
   * Process prefetch queue in batches
   */
  private processPrefetchQueue = debounce(async () => {
    const batch = Array.from(this.prefetchQueue).slice(0, this.cacheLimits.BATCH_SIZE);
    
    if (batch.length === 0) return;
    
    // Clear processed items from queue
    batch.forEach(key => this.prefetchQueue.delete(key));
    
    // Group by priority for ordered processing
    const priorityGroups = new Map<number, string[]>();
    batch.forEach(key => {
      const entry = this.memoryCache.get(key);
      const priority = entry?.priority || 999;
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(key);
    });
    
    // Process groups in priority order
    const sortedPriorities = Array.from(priorityGroups.keys()).sort();
    for (const priority of sortedPriorities) {
      const keys = priorityGroups.get(priority)!;
      await Promise.all(keys.map(key => this.revalidateKey(key)));
    }
  }, 100);

  /**
   * Revalidate a single cache key
   */
  private async revalidateKey(key: string): Promise<void> {
    // This would be implemented by the application to fetch fresh data
    // and update the cache using the set method
    this.emit('revalidate', key);
  }

  /**
   * Run garbage collection to free up memory and storage
   */
  private async runGarbageCollection(): Promise<void> {
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.staleUntil && now > entry.staleUntil) {
        this.memoryCache.delete(key);
      }
    }
    
    // Clean IndexedDB
    if (this.db) {
      const keys = await this.db.getAllKeys('cache-store');
      for (const key of keys) {
        const entry = await this.db.get('cache-store', key) as CacheEntry<any>;
        if (entry.staleUntil && now > entry.staleUntil) {
          await this.db.delete('cache-store', key);
        }
      }
    }
    
    // Clean up old metrics
    const metricsRetention = 24 * 60 * 60 * 1000; // 24 hours
    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.lastAccess > metricsRetention) {
        this.metrics.delete(key);
      }
    }
  }

  /**
   * Record cache operation metrics
   */
  private recordMetric(key: string, type: 'hit' | 'miss' | 'error', latency: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        hits: 0,
        misses: 0,
        errors: 0,
        latency: [],
        size: 0,
        lastAccess: Date.now()
      });
    }
    
    const metrics = this.metrics.get(key)!;
    if (type === 'hit') metrics.hits++;
    else if (type === 'miss') metrics.misses++;
    else if (type === 'error') metrics.errors++;
    
    metrics.latency.push(latency);
    metrics.lastAccess = Date.now();
    
    // Keep only last 100 latency measurements
    if (metrics.latency.length > 100) {
      metrics.latency.shift();
    }
  }

  /**
   * Update metrics from PerformanceObserver
   */
  private updateMetrics(entry: PerformanceEntry): void {
    if (entry.entryType === 'resource') {
      const resourceEntry = entry as PerformanceResourceTiming;
      const url = new URL(resourceEntry.name);
      const key = url.pathname;
      
      if (!this.metrics.has(key)) {
        this.metrics.set(key, {
          hits: 0,
          misses: 0,
          errors: 0,
          latency: [],
          size: 0,
          lastAccess: Date.now()
        });
      }
      
      const metrics = this.metrics.get(key)!;
      metrics.latency.push(resourceEntry.duration);
      metrics.size = resourceEntry.encodedBodySize;
      metrics.lastAccess = Date.now();
    }
  }

  /**
   * Broadcast cache updates to other tabs/windows
   */
  private broadcastUpdate(key: string, version: string | undefined): void {
    if (this.websocket?.readyState === WebSocket.OPEN && version) {
      this.websocket.send(JSON.stringify({
        type: 'update',
        key,
        version
      }));
    }
  }

  /**
   * Ensure cache size doesn't exceed limits
   */
  private async ensureCacheSize(): Promise<void> {
    // Check memory cache size
    while (this.memoryCache.size > this.cacheLimits.MEMORY_ENTRIES) {
      let lowestPriorityKey: string | null = null;
      let lowestPriority = -1;
      
      for (const [key, entry] of this.memoryCache.entries()) {
        const priority = entry.priority || 999;
        if (lowestPriorityKey === null || priority > lowestPriority) {
          lowestPriorityKey = key;
          lowestPriority = priority;
        }
      }
      
      if (lowestPriorityKey) {
        this.memoryCache.delete(lowestPriorityKey);
      }
    }
    
    // Check IndexedDB size if available
    if (this.db) {
      const estimate = await navigator.storage?.estimate();
      if (estimate?.usage && estimate.usage > this.cacheLimits.INDEXED_DB_SIZE) {
        // Remove oldest entries first
        const keys = await this.db.getAllKeys('cache-store');
        const entries = await Promise.all(
          keys.map(async (key) => ({
            key: key.toString(),
            entry: await this.db!.get('cache-store', key) as CacheEntry<any>
          }))
        );
        
        // Sort by timestamp and remove oldest
        entries.sort((a: { entry: CacheEntry<any> }, b: { entry: CacheEntry<any> }) => 
          a.entry.timestamp - b.entry.timestamp
        );
        
        // Remove entries until we're under the limit
        for (const { key } of entries) {
          const currentEstimate = await navigator.storage?.estimate();
          if (!currentEstimate?.usage || currentEstimate.usage <= this.cacheLimits.INDEXED_DB_SIZE) {
            break;
          }
          await this.db.delete('cache-store', key);
        }
      }
    }
  }

  /**
   * Get cache statistics and metrics
   */
  async getStats(): Promise<{
    memorySize: number;
    dbSize: number;
    metrics: Map<string, CacheMetrics>;
    prefetchQueueSize: number;
  }> {
    return {
      memorySize: this.memoryCache.size,
      dbSize: await (this.db ? this.getDBSize() : 0),
      metrics: this.metrics,
      prefetchQueueSize: this.prefetchQueue.size
    };
  }

  private async getDBSize(): Promise<number> {
    if (!this.db) return 0;
    const keys = await this.db.getAllKeys('cache-store');
    return keys.length;
  }

  /**
   * Clean up resources on destruction
   */
  async destroy(): Promise<void> {
    if (this.garbageCollector) {
      clearInterval(this.garbageCollector);
    }
    
    if (this.websocket) {
      this.websocket.close();
    }
    
    if (this.db) {
      this.db.close();
    }
    
    this.memoryCache.clear();
    this.metrics.clear();
    this.locks.clear();
    this.prefetchQueue.clear();
  }

  // Event emitter methods for cache events
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(...args);
      } catch (err) {
        console.error('Error in cache event listener:', err);
      }
    });
  }

  /**
   * Invalidate a specific cache key
   */
  public invalidateKey(key: string): void {
    // Remove from memory cache
    this.memoryCache.delete(key);
    
    // Remove from IndexedDB if available
    if (this.db) {
      this.db.delete('cache-store', key).catch(err => {
        console.error('Failed to invalidate key from IndexedDB:', err);
      });
    }
    
    // Emit invalidation event
    this.emit('invalidated', key);
  }
}

// Export singleton instance
export const cacheManager = new EnhancedCacheManager({
  enableMetrics: true,
  enablePrefetch: true,
  websocketUrl: process.env.CACHE_WEBSOCKET_URL || undefined
});

export const setupRealtimeInvalidation = (supabase: any): (() => void) => {
  // Initialize WebSocket connection for real-time cache invalidation
  const cacheManager = new EnhancedCacheManager({
    websocketUrl: supabase.realtime.url 
      ? `${supabase.realtime.url}/realtime/v1/websocket`
      : `wss://${import.meta.env.VITE_SUPABASE_URL}/realtime/v1/websocket`,
    enableMetrics: true,
    enablePrefetch: true
  });

  // Listen for database changes
  const channel = supabase.channel('cache-invalidation')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
      const { table, record } = payload;
      const key = `${table}:${record.id}`;
      cacheManager.invalidateKey(key);
    })
    .subscribe();
    
  // Return cleanup function
  return () => {
    channel.unsubscribe();
  };
};

/**
 * Helper function to test real-time updates
 */
export const testRealtimeUpdates = async (supabase: any): Promise<() => void> => {
  try {
    // Subscribe to changes
    console.log('Setting up real-time test subscription...');
    
    const channel = supabase.channel('test-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          console.log('Received real-time update:', payload);
        }
      )
      .subscribe((status: string) => {
        console.log('Subscription status:', status);
      });

    // Test connection
    const response = await supabase
      .from('your_table')
      .select('*')
      .limit(1);

    console.log('Test query response:', response);

    return () => {
      console.log('Cleaning up test subscription...');
      channel.unsubscribe();
    };
  } catch (error) {
    console.error('Real-time test error:', error);
    throw error;
  }
}; 