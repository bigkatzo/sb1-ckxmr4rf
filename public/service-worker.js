/**
 * StoreDot Service Worker
 * Advanced caching and network strategy implementation
 * 
 * CACHE ARCHITECTURE:
 * ------------------
 * The caching system is divided into distinct layers, each optimized for specific content:
 * 
 * 1. STATIC (7 days)
 *    - Core app files (HTML, manifest)
 *    - Rarely changes, long-term cache
 *    - Limited to essential files only
 * 
 * 2. ASSETS (24 hours)
 *    - Build-generated JS/CSS with content hashes
 *    - Automatically invalidated on new builds
 *    - Immutable until next deployment
 * 
 * 3. IMAGES (24 hours)
 *    - Optimized image handling with blob storage
 *    - CDN-backed with background revalidation
 *    - Special handling for Supabase storage
 * 
 * 4. NFT_METADATA (1 hour)
 *    - Blockchain and NFT data
 *    - Moderate refresh rate
 *    - Balance between freshness and performance
 * 
 * 5. PRODUCT_DATA (5 minutes)
 *    - Store catalog and inventory
 *    - Frequent refresh for accuracy
 *    - Critical for business operations
 * 
 * 6. DYNAMIC_DATA (30 seconds)
 *    - Real-time pricing and stock
 *    - Very short cache for time-sensitive data
 *    - Fallback to stale data on network failure
 * 
 * CACHE INVALIDATION:
 * ------------------
 * Multiple mechanisms ensure fresh content:
 * 1. Content-hash based versioning (automatic with builds)
 * 2. TTL-based expiration (per cache type)
 * 3. Manual override via CACHE_OVERRIDE constant
 * 4. Programmatic invalidation through API
 * 
 * MEMORY MANAGEMENT:
 * ----------------
 * Automatic optimization based on device capabilities:
 * - Adjusts cache sizes for low-memory devices
 * - LRU-based cache trimming
 * - Efficient response cloning per content type
 * 
 * MAINTENANCE GUIDELINES:
 * ---------------------
 * 1. Version Management:
 *    - APP_VERSION: Updated automatically during build
 *    - CACHE_OVERRIDE: Increment manually for force refresh
 * 
 * 2. Cache Limits:
 *    - Monitor metrics via GET_METRICS message
 *    - Adjust CACHE_LIMITS if hit rates are low
 *    - Consider device memory constraints
 * 
 * 3. Performance Monitoring:
 *    - Watch for high miss rates in metrics
 *    - Check average response times
 *    - Monitor error rates per cache type
 * 
 * 4. Troubleshooting:
 *    - Check service worker logs for cache operations
 *    - Use GET_VERSION to verify active version
 *    - CLEAR_ALL_CACHES for reset if needed
 */

// Add version control at the top of the file
const APP_VERSION = '1.0.0'; // This will be replaced during build
const CACHE_OVERRIDE = '1'; // Increment this to force cache invalidation

// Cache names with versioning and purpose
const CACHE_NAMES = {
  STATIC: `storedot-static-${APP_VERSION}-${CACHE_OVERRIDE}`,      // Core app files
  ASSETS: `storedot-assets-${APP_VERSION}-${CACHE_OVERRIDE}`,      // Build assets
  IMAGES: `storedot-images-${APP_VERSION}-${CACHE_OVERRIDE}`,      // Optimized images
  NFT_METADATA: `storedot-nft-${APP_VERSION}-${CACHE_OVERRIDE}`,   // Blockchain data
  PRODUCT_DATA: `storedot-products-${APP_VERSION}-${CACHE_OVERRIDE}`, // Catalog
  DYNAMIC_DATA: `storedot-dynamic-${APP_VERSION}-${CACHE_OVERRIDE}`   // Real-time data
};

// Cache TTLs in seconds - tailored to data volatility and business needs
const CACHE_TTLS = {
  STATIC: 7 * 24 * 60 * 60,    // 7 days - rarely changes
  ASSETS: 24 * 60 * 60,        // 24 hours - build-dependent
  IMAGES: 24 * 60 * 60,        // 24 hours - CDN-backed
  NFT_METADATA: 60 * 60,       // 1 hour - only for static metadata
  PRODUCT_DATA: 5 * 60,        // 5 minutes - inventory
  DYNAMIC_DATA: 30             // 30 seconds - pricing/stock
};

// Cache size limits with rationale
const CACHE_LIMITS = {
  STATIC: 100,    // Limited to core files
  ASSETS: 200,    // Covers main chunks and dynamic imports
  IMAGES: 300,    // Balance between UX and memory
  NFT_METADATA: 1000, // Large to minimize blockchain calls
  PRODUCT_DATA: 500,  // Cover main catalog
  DYNAMIC_DATA: 100   // Short-lived, keep minimal
};

// Request patterns for different cache types
const REQUEST_PATTERNS = {
  STATIC: [
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/favicon.ico'
  ],
  ASSETS: [
    '/assets/',
    '/css/',
    '/js/'
  ],
  IMAGES: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '/storage/images/'
  ],
  NFT_METADATA: [
    '/api/nft/metadata/',      // Static NFT metadata only
    '/api/nft/collection/',    // Static collection data
    '/api/nft/attributes/'     // Static attribute data
  ],
  PRODUCT_DATA: [
    '/api/products/',
    '/api/categories/',
    '/api/collections/'
  ],
  DYNAMIC_DATA: [
    '/api/pricing/',
    '/api/stock/',
    '/api/availability/'
  ]
};

// Never cache these patterns
const NO_CACHE_PATTERNS = [
  '/api/blockchain/transfer',
  '/api/blockchain/mint',
  '/api/blockchain/sign',
  '/api/nft/verify',
  '/api/nft/check',
  '/api/nft/balance',         // Never cache balances
  '/api/nft/ownership',       // Never cache ownership
  '/api/nft/price',          // Never cache prices
  '/api/blockchain/verify',
  '/api/blockchain/status',   // Never cache transaction status
  '/api/blockchain/ownership',
  '/api/checkout',
  '/api/payment',
  '/api/orders',
  '/api/auth/',
  '/api/user/',
  'stripe.com',
  'js.stripe.com',
  'api.stripe.com',
  'hooks.stripe.com'
];

// RPC methods that should never be cached
const NO_CACHE_RPC_METHODS = [
  'eth_sendTransaction',
  'eth_sendRawTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTransaction'
];

// Cache monitoring metrics
const metrics = {
  hits: {},
  misses: {},
  errors: {},
  timing: {}
};

// Initialize metrics for each cache type
Object.keys(CACHE_NAMES).forEach(type => {
  metrics.hits[type] = 0;
  metrics.misses[type] = 0;
  metrics.errors[type] = 0;
  metrics.timing[type] = [];
});

// Version check endpoint
const VERSION_CHECK_URL = '/api/version';

// Function to check for updates - only called on page refresh
async function checkForUpdates() {
  try {
    const response = await fetch(VERSION_CHECK_URL, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) return false;
    
    const { version } = await response.json();
    if (version !== APP_VERSION) {
      console.log(`New version available: ${version}`);
      // Don't automatically clear caches or unregister
      // Just notify the client that an update is available
      await notifyClientsToUpdate(version);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Version check failed:', error);
    return false;
  }
}

// Function to notify clients about update
async function notifyClientsToUpdate(newVersion) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'UPDATE_AVAILABLE',
      version: newVersion
    });
  });
}

// Helper function to determine cache type for a request
function getCacheType(request) {
  const url = new URL(request.url);
  
  // First check if this should not be cached
  if (NO_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    return null;
  }
  
  // Check RPC methods
  if (url.pathname.includes('/rpc')) {
    try {
      const body = request.clone().json();
      if (NO_CACHE_RPC_METHODS.includes(body.method)) {
        return null;
      }
    } catch (e) {
      console.warn('Failed to parse RPC request body:', e);
      return null;
    }
  }
  
  // Match against patterns
  for (const [type, patterns] of Object.entries(REQUEST_PATTERNS)) {
    if (patterns.some(pattern => {
      return pattern.startsWith('/')
        ? url.pathname.includes(pattern)
        : url.pathname.endsWith(pattern);
    })) {
      return type;
    }
  }
  
  return null;
}

// Helper function to add cache headers to response
async function addCacheHeaders(response, cacheType) {
  const headers = new Headers(response.headers);
  const ttl = CACHE_TTLS[cacheType];
  
  if (ttl) {
    headers.set('Cache-Control', `public, max-age=${ttl}`);
    headers.set('X-Cache-TTL', ttl.toString());
    headers.set('X-Cache-Type', cacheType);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Helper function to record metrics
function recordMetric(cacheType, status, duration) {
  if (!cacheType) return;
  
  if (status === 'hit') {
    metrics.hits[cacheType]++;
  } else if (status === 'miss') {
    metrics.misses[cacheType]++;
  } else if (status === 'error') {
    metrics.errors[cacheType]++;
  }
  
  if (duration) {
    metrics.timing[cacheType].push(duration);
    // Keep only last 100 timing measurements
    if (metrics.timing[cacheType].length > 100) {
      metrics.timing[cacheType].shift();
    }
  }
}

// Helper function to check if URL is from Supabase storage
function isSupabaseStorageUrl(url) {
  return url.hostname.includes('supabase.co') && 
         (url.pathname.includes('/storage/v1/object') || 
          url.pathname.includes('/storage/v1/render'));
}

// Helper to identify LCP candidate images
function isLcpCandidate(url) {
  // Check for images with high priority markers
  const isHighPriority = url.searchParams.has('priority') || 
                         url.searchParams.has('fetchpriority') ||
                         url.searchParams.get('fetchpriority') === 'high';
  
  // Check for collection hero images which are typically LCP
  const isHeroImage = url.pathname.includes('collection-images') || 
                      url.pathname.includes('hero') ||
                      url.pathname.includes('featured');
                      
  // Check for render endpoint which is used for our optimized images
  const isOptimized = url.pathname.includes('/storage/v1/render/image');
  
  return (isHighPriority || isHeroImage) && isOptimized;
}

// Main fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Completely bypass service worker for Stripe resources
  if (url.hostname.includes('stripe.com')) {
    return; // This lets the browser handle the request normally
  }
  
  // Special handling for Supabase storage URLs
  if (isSupabaseStorageUrl(url)) {
    // Bypass service worker for POST requests to storage
    if (event.request.method === 'POST') {
      event.respondWith(fetch(event.request));
      return;
    }
    
    // Use special LCP-optimized handling for important images
    if (isLcpCandidate(url)) {
      event.respondWith(handleLcpImageRequest(event.request));
      return;
    }
    
    event.respondWith(handleSupabaseStorageRequest(event.request));
    return;
  }

  const cacheType = getCacheType(event.request);
  
  // Don't cache if no matching cache type
  if (!cacheType) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith((async () => {
    const startTime = Date.now();
    try {
      const cache = await caches.open(CACHE_NAMES[cacheType]);
      let cachedResponse = await cache.match(event.request);
      
      // Check if cached response is still fresh
      if (cachedResponse) {
        const cachedTtl = cachedResponse.headers.get('X-Cache-TTL');
        const cachedTime = cachedResponse.headers.get('X-Cache-Time');
        
        if (cachedTtl && cachedTime) {
          const age = (Date.now() - parseInt(cachedTime)) / 1000;
          if (age < parseInt(cachedTtl)) {
            recordMetric(cacheType, 'hit', Date.now() - startTime);
            return cachedResponse;
          }
        }
      }
      
      // If no cache or stale, fetch from network with retry
      try {
        const networkResponse = await fetchWithRetry(event.request.clone());
        if (networkResponse.ok) {
          const cachedResponse = await addCacheHeaders(networkResponse.clone(), cacheType);
          await cache.put(event.request, cachedResponse);
          await trimCache(CACHE_NAMES[cacheType], CACHE_LIMITS[cacheType]);
          recordMetric(cacheType, 'miss', Date.now() - startTime);
          return networkResponse;
        }
        
        // If network fails and we have cached response, return it
        if (cachedResponse) {
          console.log('Network failed, using cached response');
          recordMetric(cacheType, 'error', Date.now() - startTime);
          return cachedResponse;
        }
        
        throw new Error('Network response was not ok');
      } catch (networkError) {
        console.error('Network fetch error:', networkError);
        // If we have a cached response, return it as fallback
        if (cachedResponse) {
          console.log('Network error, using cached response');
          recordMetric(cacheType, 'error', Date.now() - startTime);
          return cachedResponse;
        }
        throw networkError;
      }
    } catch (error) {
      recordMetric(cacheType, 'error', Date.now() - startTime);
      throw error;
    }
  })());
});

/**
 * Memory and device optimization constants
 * Adjusts cache behavior based on device capabilities
 */
const MEMORY_INFO = {
  LOW_MEMORY_THRESHOLD: 100 * 1024 * 1024,  // 100MB - reduce caching
  CRITICAL_MEMORY_THRESHOLD: 50 * 1024 * 1024,  // 50MB - minimal caching
  DEFAULT_DEVICE_MEMORY: 4  // 4GB default if not available
};

/**
 * Dynamic cache size adjustment based on device memory
 * Reduces cache sizes on low-memory devices to prevent OOM
 * @returns {Object} Adjusted cache limits
 */
function getDynamicCacheLimits() {
  const deviceMemory = navigator.deviceMemory || MEMORY_INFO.DEFAULT_DEVICE_MEMORY;
  const isLowMemoryDevice = deviceMemory < 4;
  
  return {
    STATIC: isLowMemoryDevice ? 50 : CACHE_LIMITS.STATIC,
    ASSETS: isLowMemoryDevice ? 100 : CACHE_LIMITS.ASSETS,
    IMAGES: isLowMemoryDevice ? 150 : CACHE_LIMITS.IMAGES,
    NFT_METADATA: isLowMemoryDevice ? 500 : CACHE_LIMITS.NFT_METADATA,
    PRODUCT_DATA: isLowMemoryDevice ? 250 : CACHE_LIMITS.PRODUCT_DATA,
    DYNAMIC_DATA: isLowMemoryDevice ? 50 : CACHE_LIMITS.DYNAMIC_DATA
  };
}

/**
 * Atomic cache operations handler
 * Ensures thread-safe cache operations using locks
 */
class AtomicCache {
  constructor(cacheName) {
    this.cacheName = cacheName;
    this.lockPromises = new Map();
  }
  
  /**
   * Acquire a lock for atomic operations
   * @param {string} key - Cache key to lock
   * @param {number} timeout - Lock timeout in ms
   * @returns {Function} Lock release function
   */
  async acquireLock(key, timeout = 5000) {
    if (this.lockPromises.has(key)) {
      await this.lockPromises.get(key);
    }
    
    let releaseLock;
    const lockPromise = new Promise(resolve => {
      releaseLock = resolve;
    });
    
    this.lockPromises.set(key, lockPromise);
    
    // Auto-release lock after timeout
    setTimeout(() => {
      if (this.lockPromises.get(key) === lockPromise) {
        this.releaseLock(key);
      }
    }, timeout);
    
    return () => this.releaseLock(key);
  }
  
  /**
   * Release a previously acquired lock
   * @param {string} key - Cache key to unlock
   */
  releaseLock(key) {
    const lockPromise = this.lockPromises.get(key);
    if (lockPromise) {
      this.lockPromises.delete(key);
      lockPromise();
    }
  }
  
  /**
   * Perform an atomic cache update
   * @param {string} key - Cache key to update
   * @param {Function} updateFn - Update function
   * @returns {Promise} Update result
   */
  async atomicUpdate(key, updateFn) {
    const releaseLock = await this.acquireLock(key);
    try {
      const cache = await caches.open(this.cacheName);
      return await updateFn(cache);
    } finally {
      releaseLock();
    }
  }
}

/**
 * Efficient response cloning based on content type
 * Optimizes memory usage for different content types
 * @param {Response} response - Response to clone
 * @param {string} cacheType - Type of cache
 * @returns {Promise<Response>} Cloned response
 */
async function efficientResponseClone(response, cacheType) {
  if (response.headers.get('Cache-Control')?.includes('no-store')) {
    return response;
  }
  
  if (response.bodyUsed) {
    return await fetch(response.url);
  }
  
  // Special handling for images using blob storage
  if (cacheType === 'IMAGES') {
    const blob = await response.blob();
    return new Response(blob, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
  }
  
  // Parse and stringify JSON to ensure clean clone
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
  }
  
  return response.clone();
}

/**
 * LRU cache trimming implementation
 * Removes least recently used items when cache exceeds limits
 * @param {string} cacheName - Cache to trim
 * @param {number} maxItems - Maximum items to keep
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  // Get dynamic limits based on device memory
  const dynamicLimits = getDynamicCacheLimits();
  const adjustedMaxItems = dynamicLimits[cacheName.split('-')[1]] || maxItems;
  
  if (keys.length > adjustedMaxItems) {
    console.log(`Trimming cache ${cacheName} (${keys.length} > ${adjustedMaxItems})`);
    
    // Get metadata for LRU implementation
    const keyMetadata = await Promise.all(keys.map(async key => {
      const response = await cache.match(key);
      const lastAccessed = response?.headers?.get('X-Last-Accessed') || 0;
      return { key, lastAccessed: parseInt(lastAccessed) || 0 };
    }));
    
    // Sort by access time and remove oldest
    keyMetadata.sort((a, b) => a.lastAccessed - b.lastAccessed);
    const keysToDelete = keyMetadata
      .slice(0, keys.length - adjustedMaxItems)
      .map(item => item.key);
    
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

const CACHE_CONFIG = {
  IMAGES: {
    maxItems: 100, // Maximum number of items to keep in cache
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
    version: '1' // Cache version
  }
};

// Helper function to manage cache size and age
async function maintainCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const config = CACHE_CONFIG[cacheName.split('-')[1]] || {};
  const now = Date.now();

  const itemsWithMetadata = await Promise.all(
    keys.map(async (request) => {
      const response = await cache.match(request);
      const timestamp = Number(response?.headers.get('X-Cache-Time') || 0);
      return { request, timestamp };
    })
  );

  // Remove expired items
  const expired = itemsWithMetadata.filter(
    ({ timestamp }) => now - timestamp > config.maxAge
  );
  await Promise.all(expired.map(({ request }) => cache.delete(request)));

  // Sort remaining by timestamp (oldest first)
  const remaining = itemsWithMetadata
    .filter(({ timestamp }) => now - timestamp <= config.maxAge)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Remove oldest items if we're over the limit
  if (remaining.length > config.maxItems) {
    const toRemove = remaining.slice(0, remaining.length - config.maxItems);
    await Promise.all(toRemove.map(({ request }) => cache.delete(request)));
  }
}

// Helper function to fetch with retry
async function fetchWithRetry(request, maxRetries = 2) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(request.clone());
      if (response.ok) return response;
      lastError = new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      lastError = error;
      if (i === maxRetries) break;
      // Wait 1s, then 2s before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError;
}

// Simplified Supabase storage handling
async function handleSupabaseStorageRequest(request) {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const url = new URL(request.url);
  
  // Create cache key without parameters
  const cacheUrl = new URL(url.toString());
  cacheUrl.searchParams.delete('priority');
  cacheUrl.searchParams.delete('visible');
  const cacheRequest = new Request(cacheUrl.toString());
  
  // Check cache first
  const cachedResponse = await cache.match(cacheRequest);
  if (cachedResponse) {
    // Validate cache version
    const cacheVersion = cachedResponse.headers.get('X-Cache-Version');
    if (cacheVersion === CACHE_CONFIG.IMAGES.version) {
      // Background revalidate if older than 1 hour
      const cachedTime = parseInt(cachedResponse.headers.get('X-Cache-Time') || '0');
      if (Date.now() - cachedTime > 3600000) { // 1 hour
        fetchAndCache().catch(console.error);
      }
      return cachedResponse.clone();
    }
  }
  
  return fetchAndCache();
  
  async function fetchAndCache() {
    try {
      const response = await fetch(request.clone(), {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/*',
          'Cache-Control': 'no-cache',
          'X-Client-Info': 'service-worker'
        }
      });
      
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('X-Cache-Time', Date.now().toString());
        headers.set('X-Cache-Version', CACHE_CONFIG.IMAGES.version);
        
        const enhancedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
        
        await cache.put(cacheRequest, enhancedResponse.clone());
        return enhancedResponse;
      }
      
      throw new Error('Network response was not ok');
    } catch (error) {
      console.error('Supabase storage fetch error:', error);
      if (cachedResponse) return cachedResponse.clone();
      throw error;
    }
  }
}

// Specialized handler for LCP image requests - prioritizes speed over freshness
async function handleLcpImageRequest(request) {
  const startTime = Date.now();
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  
  try {
    // Check cache first with a fast path return
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Return cached response immediately without freshness check
      recordMetric('IMAGES', 'hit', Date.now() - startTime);
      
      // Once we've returned the cached version, try to update it in the background
      // This ensures we have a fresh version for next time without delaying this response
      setTimeout(() => {
        updateLcpImageCache(request, cache).catch(err => {
          console.warn('Background LCP image update failed:', err);
        });
      }, 50);
      
      return cachedResponse;
    }
    
    // No cache hit, fetch from network with safety
    try {
      const networkResponse = await fetch(request.clone(), {
        // Add cache control headers to prevent browser caching conflicts
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Shorter timeout for LCP images
        signal: AbortSignal.timeout(3000)
      });
      
      if (!networkResponse.ok) {
        throw new Error(`Network response error: ${networkResponse.status}`);
      }
      
      // Cache the response
      try {
        // Use a more robust cloning method
        const responseToCache = new Response(
          networkResponse.clone().body,
          {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: new Headers(networkResponse.headers)
          }
        );
        
        // Add cache headers
        responseToCache.headers.set('X-Cache-Time', Date.now().toString());
        responseToCache.headers.set('X-Cache-TTL', CACHE_TTLS.IMAGES.toString());
        responseToCache.headers.set('X-Cache-Type', 'IMAGES');
        
        await cache.put(request, responseToCache);
      } catch (cacheError) {
        console.warn('Failed to cache LCP image:', cacheError);
        // Continue even if caching fails
      }
      
      recordMetric('IMAGES', 'miss', Date.now() - startTime);
      return networkResponse;
    } catch (networkError) {
      console.warn('Network fetch for LCP image failed:', networkError);
      // If network fetch fails but we have a cached response from a previous visit, use it
      const fallbackCachedResponse = await cache.match(request);
      if (fallbackCachedResponse) {
        console.log('Using cached fallback for failed LCP image fetch');
        recordMetric('IMAGES', 'error-with-fallback', Date.now() - startTime);
        return fallbackCachedResponse;
      }
      
      // If all else fails, fetch directly bypassing our custom logic
      console.log('Attempting direct fetch for LCP image as last resort');
      return fetch(request);
    }
  } catch (error) {
    console.error('LCP image request failed:', error);
    recordMetric('IMAGES', 'error', Date.now() - startTime);
    // Last resort - pass the request to the browser
    return fetch(request);
  }
}

// Background update for LCP images cache
async function updateLcpImageCache(request, cache) {
  try {
    // Use a separate fetch with timeout to avoid hanging
    const networkResponse = await fetch(request.clone(), {
      // Add cache busting to ensure fresh content
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      // Use a longer timeout for background updates
      signal: AbortSignal.timeout(5000)
    });
    
    if (!networkResponse.ok) return;
    
    try {
      // Create a new response with appropriate cache headers
      const now = Date.now();
      const headers = new Headers(networkResponse.headers);
      headers.set('X-Cache-Time', now.toString());
      headers.set('X-Cache-TTL', CACHE_TTLS.IMAGES.toString());
      headers.set('X-Cache-Type', 'IMAGES');
      headers.set('Cache-Control', `public, max-age=${CACHE_TTLS.IMAGES}`);
      
      const cachedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      await cache.put(request, cachedResponse);
      console.log('LCP image updated in background');
    } catch (cacheError) {
      console.warn('Failed to update LCP image in cache:', cacheError);
    }
  } catch (error) {
    console.warn('Background LCP image update failed:', error);
  }
}

// Modify the install event to be less aggressive
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      try {
        // Only cache static assets
        const cache = await caches.open(CACHE_NAMES.STATIC);
        await cache.addAll(REQUEST_PATTERNS.STATIC);
        // Don't check for updates during install
        await self.skipWaiting();
      } catch (error) {
        console.error('Service worker installation failed:', error);
        await self.skipWaiting();
      }
    })()
  );
});

// Modify activate event to be less aggressive
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        // Get all cache keys
        const cacheKeys = await caches.keys();
        
        // Get current cache names
        const currentCaches = Object.values(CACHE_NAMES);
        
        // Delete old caches
        await Promise.all(
          cacheKeys
            .filter(key => !currentCaches.includes(key))
            .map(key => caches.delete(key))
        );
        
        // Take control of all clients
        await self.clients.claim();
        
        // Don't start periodic checks
      } catch (error) {
        console.error('Service worker activation failed:', error);
      }
    })()
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle cache invalidation messages
  if (event.data && event.data.type === 'INVALIDATE_CACHE') {
    const { cacheName, url } = event.data;
    
    if (cacheName && url) {
      // Invalidate specific URL in specific cache
      caches.open(cacheName).then(cache => {
        cache.delete(url).then(success => {
          console.log(`Invalidated ${url} in ${cacheName}: ${success}`);
        });
      });
    } else if (cacheName) {
      // Invalidate entire cache
      caches.delete(cacheName).then(success => {
        console.log(`Deleted cache ${cacheName}: ${success}`);
      });
    }
  }

  // Handle clear all caches message
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName).then(success => {
            console.log(`Deleted cache ${cacheName}: ${success}`);
          });
        })
      );
    });
  }

  // Handle version check request
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: APP_VERSION
    });
  }
  
  // Add metrics reporting endpoint
  if (event.data && event.data.type === 'GET_METRICS') {
    // Calculate hit rates and average timings
    const stats = Object.keys(CACHE_NAMES).reduce((acc, type) => {
      const total = metrics.hits[type] + metrics.misses[type];
      const hitRate = total > 0 ? (metrics.hits[type] / total) * 100 : 0;
      const avgTiming = metrics.timing[type].length > 0 
        ? metrics.timing[type].reduce((a, b) => a + b) / metrics.timing[type].length 
        : 0;
      
      acc[type] = {
        hitRate: hitRate.toFixed(2) + '%',
        avgResponseTime: avgTiming.toFixed(2) + 'ms',
        hits: metrics.hits[type],
        misses: metrics.misses[type],
        errors: metrics.errors[type]
      };
      return acc;
    }, {});
    
    // Send metrics back to client
    event.source.postMessage({
      type: 'METRICS_REPORT',
      stats
    });
  }
}); 