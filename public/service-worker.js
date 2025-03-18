/**
 * StoreDot Service Worker
 * Provides advanced network caching strategies
 */

// Cache names with versioning
const CACHE_NAMES = {
  STATIC: 'storedot-static-v1',
  ASSETS: 'storedot-assets-v1',
  IMAGES: 'storedot-images-v1',
  NFT_METADATA: 'storedot-nft-v1',
  PRODUCT_DATA: 'storedot-products-v1',
  DYNAMIC_DATA: 'storedot-dynamic-v1'
};

// Cache TTLs in seconds
const CACHE_TTLS = {
  STATIC: 7 * 24 * 60 * 60,    // 7 days
  ASSETS: 24 * 60 * 60,        // 24 hours
  IMAGES: 24 * 60 * 60,        // 24 hours
  NFT_METADATA: 60 * 60,       // 1 hour
  PRODUCT_DATA: 5 * 60,        // 5 minutes
  DYNAMIC_DATA: 30             // 30 seconds
};

// Cache size limits
const CACHE_LIMITS = {
  STATIC: 100,
  ASSETS: 200,
  IMAGES: 300,
  NFT_METADATA: 1000,
  PRODUCT_DATA: 500,
  DYNAMIC_DATA: 100
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
    '/api/nft/',
    '/api/metadata/',
    '/api/collections/'
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
  '/api/checkout',
  '/api/payment',
  '/api/orders',
  '/api/auth/',
  '/api/user/'
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

// Main fetch handler
self.addEventListener('fetch', (event) => {
  const cacheType = getCacheType(event.request);
  const startTime = Date.now();
  
  // Don't cache if no matching cache type
  if (!cacheType) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAMES[cacheType]);
    
    try {
      // Try cache first
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        // Check if cached response is still fresh
        const cachedTtl = cachedResponse.headers.get('X-Cache-TTL');
        const cachedTime = cachedResponse.headers.get('X-Cache-Time');
        
        if (cachedTtl && cachedTime) {
          const age = (Date.now() - parseInt(cachedTime)) / 1000;
          if (age < parseInt(cachedTtl)) {
            // Cache hit
            recordMetric(cacheType, 'hit', Date.now() - startTime);
            return cachedResponse;
          }
        }
      }
      
      // Cache miss, fetch from network
      recordMetric(cacheType, 'miss');
      const networkResponse = await fetch(event.request);
      
      if (networkResponse.ok) {
        // Add cache headers and store in cache
        const cachedResponse = await addCacheHeaders(networkResponse.clone(), cacheType);
        await cache.put(event.request, cachedResponse);
        
        // Trim cache if needed
        await trimCache(CACHE_NAMES[cacheType], CACHE_LIMITS[cacheType]);
        
        recordMetric(cacheType, 'network', Date.now() - startTime);
        return networkResponse;
      }
      throw new Error('Network response was not ok');
    } catch (error) {
      recordMetric(cacheType, 'error');
      // If network fails and we have cached data, return it
      if (cachedResponse) {
        console.log('Network failed, using cached data:', error);
        return cachedResponse;
      }
      throw error;
    }
  })());
});

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        // Use a more resilient approach to caching static files
        return Promise.all(
          REQUEST_PATTERNS.STATIC.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.warn(`Failed to cache ${url}: ${response.status} ${response.statusText}`);
                return Promise.resolve(); // Continue even if one resource fails
              })
              .catch(error => {
                console.warn(`Failed to fetch ${url} for caching:`, error);
                return Promise.resolve(); // Continue even if one resource fails
              });
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Static caching completed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed:', error);
        return self.skipWaiting(); // Skip waiting even if caching fails
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAMES.STATIC, CACHE_NAMES.ASSETS, CACHE_NAMES.IMAGES, CACHE_NAMES.NFT_METADATA, CACHE_NAMES.PRODUCT_DATA, CACHE_NAMES.DYNAMIC_DATA];
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return cacheNames.filter(
          (cacheName) => !currentCaches.includes(cacheName)
        );
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            console.log('Service Worker: Deleting old cache', cacheToDelete);
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Helper function to clean up caches when they get too large
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    console.log(`Trimming cache ${cacheName} (${keys.length} > ${maxItems})`);
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

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