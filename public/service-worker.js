/**
 * StoreDot Service Worker
 * Provides advanced network caching strategies
 */

// Cache names
const STATIC_CACHE_NAME = 'storedot-static-v1';
const API_CACHE_NAME = 'storedot-api-v1';
const IMAGE_CACHE_NAME = 'storedot-images-v1';

// Resources to cache immediately on install
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/css/main.css',
  '/assets/js/main.js'
];

// Cache size limits
const API_CACHE_MAX_ITEMS = 200;
const IMAGE_CACHE_MAX_ITEMS = 100;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
  
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

// Helper to determine if a request is for an API endpoint
function isApiRequest(url) {
  return url.pathname.includes('/api/') || 
         url.pathname.includes('/rest/') || 
         url.hostname.includes('supabase');
}

// Helper to determine if a request is for an image
function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
  return imageExtensions.some(ext => url.pathname.endsWith(ext)) || 
         url.pathname.includes('/storage/') ||
         url.pathname.includes('/images/');
}

// Fetch event - handle different caching strategies based on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('supabase.co')) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Different caching strategies based on request type
  if (isApiRequest(url)) {
    // API requests: Stale-while-revalidate strategy
    event.respondWith(handleApiRequest(event.request));
  } else if (isImageRequest(url)) {
    // Image requests: Cache-first strategy
    event.respondWith(handleImageRequest(event.request));
  } else {
    // Static assets: Cache-first with network fallback
    event.respondWith(handleStaticRequest(event.request));
  }
});

/**
 * Handle API requests with stale-while-revalidate strategy
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  
  // Clone the request because it can only be used once
  const fetchPromise = fetch(request.clone())
    .then(async (networkResponse) => {
      // Only cache successful responses
      if (networkResponse.ok) {
        // Check cache control headers
        const cacheControl = networkResponse.headers.get('Cache-Control');
        if (cacheControl && !cacheControl.includes('no-store')) {
          // Clone the response because it can only be used once
          await cache.put(request, networkResponse.clone());
          
          // Trim cache if needed
          await trimCache(API_CACHE_NAME, API_CACHE_MAX_ITEMS);
        }
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('Service Worker: API fetch failed', error);
      // If we have a cached response, return it even if it's stale
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    });
  
  // Return cached response immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

/**
 * Handle image requests with cache-first strategy
 */
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      // Clone the response because it can only be used once
      await cache.put(request, networkResponse.clone());
      
      // Trim cache if needed
      await trimCache(IMAGE_CACHE_NAME, IMAGE_CACHE_MAX_ITEMS);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Image fetch failed', error);
    throw error;
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      // Clone the response because it can only be used once
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static fetch failed', error);
    
    // For navigation requests, return the offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
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
}); 