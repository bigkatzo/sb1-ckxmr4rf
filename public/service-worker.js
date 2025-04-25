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
                      
  // Check for product images which might be LCP on product pages 
  const isProductImage = url.pathname.includes('product-images');
                      
  // Check for render endpoint which is used for our optimized images
  const isOptimized = url.pathname.includes('/storage/v1/render/image');
  
  return ((isHighPriority && (isHeroImage || isProductImage)) || isHeroImage) && isOptimized;
}

// Helper to detect if image is a product image
function isProductImage(url) {
  return url.hostname.includes('supabase.co') && 
         url.pathname.includes('product-images');
}

// Advanced but efficient image fetch with fallbacks
async function fetchImageWithFallbacks(request, options = {}) {
  const url = new URL(request.url);
  const { timeout = 5000, useNoCorsFallback = true } = options;
  
  // Check for problematic characters in URL
  const hasProblematicChars = url.pathname.includes('(') || 
                               url.pathname.includes(')') || 
                               url.pathname.includes(' ');
  
  // For WebP and problematic files, skip the render endpoint entirely
  if (url.hostname.includes('supabase.co') && 
      (url.pathname.endsWith('.webp') || url.pathname.includes('-d') || hasProblematicChars)) {
    
    // Special handling for URLs with problematic characters
    if (hasProblematicChars) {
      try {
        // Get the path parts to fix the filename
        const pathParts = url.pathname.split('/');
        const fileNameIndex = pathParts.length - 1;
        const originalFilename = pathParts[fileNameIndex];
        
        // Encode problematic characters properly
        let decodedFilename;
        try {
          // First try to decode in case it's already partially encoded
          decodedFilename = decodeURIComponent(originalFilename);
        } catch {
          decodedFilename = originalFilename;
        }
        
        // Re-encode properly
        const encodedFilename = encodeURIComponent(decodedFilename)
          .replace(/%20/g, '-')  // Convert spaces to hyphens
          .replace(/%28/g, '')   // Remove opening parentheses
          .replace(/%29/g, '')   // Remove closing parentheses
          .replace(/%2F/g, '-'); // Replace slashes with hyphens
        
        // Replace the filename part in the path
        pathParts[fileNameIndex] = encodedFilename;
        
        // Convert render to object URL for these problematic formats
        if (url.pathname.includes('/storage/v1/render/image/public/')) {
          pathParts[pathParts.indexOf('render')] = 'object';
          url.pathname = pathParts.join('/');
          url.search = ''; // Remove query params for object URLs
          
          console.log('Sanitized URL with special characters:', url.toString());
          try {
            const response = await fetch(new Request(url.toString(), {
              headers: request.headers,
              mode: request.mode,
              credentials: request.credentials
            }));
            if (response.ok) {
              return response;
            }
          } catch (e) {
            console.warn('Sanitized URL fetch failed:', e);
          }
        }
      } catch (e) {
        console.warn('Error handling special characters in URL:', e);
      }
    }
    
    // Convert render to object URL for these problematic formats
    if (url.pathname.includes('/storage/v1/render/image/public/')) {
      const pathMatch = url.pathname.match(/\/storage\/v1\/render\/image\/public\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        const objectPath = pathMatch[1];
        const objectUrl = `${url.protocol}//${url.hostname}/storage/v1/object/public/${objectPath}`;
        
        console.log('Using object URL directly for problematic file:', objectUrl);
        try {
          const response = await fetch(objectUrl);
          if (response.ok) {
            return response;
          }
        } catch (e) {
          console.warn('Direct object URL failed for problematic file:', e);
        }
      }
    }
  }
  
  // Always normalize any Supabase URLs to ensure we start with render endpoint
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    // Skip render conversion for WebP files or filenames with dashes
    if (url.pathname.endsWith('.webp') || url.pathname.includes('-d')) {
      console.log('Skipping render endpoint for WebP/problematic file:', url.toString());
      return fetch(request);
    }
    
    // Only convert JPG and PNG to render endpoint
    const isJpgOrPng = /\.(jpe?g|png)$/i.test(url.pathname);
    if (!isJpgOrPng) {
      console.log('Skipping render endpoint for non-jpg/png file:', url.toString());
      return fetch(request);
    }
    
    // Convert object endpoint to render endpoint before starting fetch attempts
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
    if (pathMatch && pathMatch[1]) {
      const objectPath = pathMatch[1];
      const renderPath = `/storage/v1/render/image/public/${objectPath}`;
      
      // Add required parameters for better compatibility
      const params = new URLSearchParams(url.search);
      if (!params.has('width')) params.append('width', '800');
      if (!params.has('quality')) params.append('quality', '80');
      params.append('format', 'original');
      
      const renderUrl = `${url.protocol}//${url.hostname}${renderPath}?${params.toString()}`;
      
      // Create a new request using the render endpoint
      const renderRequest = new Request(renderUrl, {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect
      });
      
      console.log('Normalized object URL to render URL:', renderUrl);
      // Continue with the render request instead
      request = renderRequest;
      url.pathname = renderPath;
    }
  }
  
  // First attempt: Try with render endpoint (which should be normalized by now)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/render/image/')) {
    try {
      // Try direct fetch with render endpoint and parameters
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(request.clone(), {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (response.ok) {
          console.log('Render endpoint fetch succeeded');
          return response;
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.log('Render endpoint fetch failed:', e);
      }
      
      // Second attempt: Try render endpoint without query params
      if (url.search) {
        const renderUrlWithoutParams = `${url.protocol}//${url.hostname}${url.pathname}`;
        console.log('Trying render endpoint without params:', renderUrlWithoutParams);
        
        try {
          const renderResponse = await fetch(renderUrlWithoutParams);
          if (renderResponse.ok) {
            console.log('Render endpoint without params succeeded');
            return renderResponse;
          }
        } catch (e) {
          console.log('Render endpoint without params failed:', e);
        }
      }
      
      // Third attempt: Convert to object URL as fallback
      const pathMatch = url.pathname.match(/\/storage\/v1\/render\/image\/public\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        // Extract just the path part before any query params
        const objectPath = pathMatch[1].split('?')[0];
        const objectUrl = `${url.protocol}//${url.hostname}/storage/v1/object/public/${objectPath}`;
        
        console.log('Trying fallback to object URL:', objectUrl);
        const objectResponse = await fetch(objectUrl);
        if (objectResponse.ok) {
          console.log('Object URL fetch succeeded');
          return objectResponse;
        }
      }
    } catch (e) {
      console.warn('All Supabase URL variations failed:', e);
    }
  } else {
    // Standard fetch with timeout for non-Supabase URLs
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(request.clone(), {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (response.ok) return response;
    } catch (e) {
      console.warn(`Basic fetch failed for ${url.toString()}:`, e);
    }
  }
  
  // Last resort: no-cors mode (if enabled)
  if (useNoCorsFallback) {
    try {
      console.log('Attempting no-cors fetch as last resort');
      return await fetch(request.clone(), { 
        mode: 'no-cors',
        cache: 'no-store'
      });
    } catch (e) {
      console.warn('No-cors fallback failed:', e);
    }
  }
  
  // All attempts failed
  return null;
}

// Unified image caching helper to reduce code duplication
async function cacheImage(response, request, cache) {
  if (!response || !response.ok) return null;
  
  try {
    // Create a proper clone with the right headers
    const cachedResponse = new Response(
      response.clone().body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      }
    );
    
    // Add cache metadata
    cachedResponse.headers.set('X-Cache-Time', Date.now().toString());
    cachedResponse.headers.set('X-Cache-TTL', CACHE_TTLS.IMAGES.toString());
    cachedResponse.headers.set('X-Cache-Type', 'IMAGES');
    
    // Store in cache
    await cache.put(request, cachedResponse);
    return cachedResponse;
  } catch (e) {
    console.warn('Failed to cache image response:', e);
    return null;
  }
}

// Product gallery prefetching implementation
// Industry-standard optimization for handling product image galleries
const GALLERY_PREFETCH = {
  // Queue of gallery images to prefetch with their priorities
  queue: new Map(), // Map<url, {priority, productId, index}>
  activeRequests: 0,
  maxConcurrentRequests: 4,
  // Track which galleries have been prefetched
  prefetchedGalleries: new Set(),
  // Track which images are being processed
  processingImages: new Set(),
  
  // Initialize prefetching for a specific product gallery
  async initGallery(productId, imageUrls, currentIndex = 0) {
    // Don't prefetch the same gallery multiple times
    if (this.prefetchedGalleries.has(productId)) {
      return;
    }
    
    this.prefetchedGalleries.add(productId);
    
    if (!imageUrls || !imageUrls.length) {
      return;
    }
    
    console.log(`Initializing prefetch for product gallery: ${productId} with ${imageUrls.length} images`);
    
    // Always prioritize the first few images
    // Add with different priorities based on position relative to current view
    imageUrls.forEach((url, index) => {
      let priority = 5; // Default medium priority
      
      // Current image gets highest priority (though it's likely already loaded)
      if (index === currentIndex) {
        priority = 10;
      } 
      // Next image gets high priority
      else if (index === currentIndex + 1) {
        priority = 9;
      }
      // Previous image gets medium-high priority
      else if (index === currentIndex - 1 && index >= 0) {
        priority = 8;
      }
      // Next 2 images get medium priority
      else if (index === currentIndex + 2 || index === currentIndex + 3) {
        priority = 7;
      }
      // Previous 2 images get medium-low priority
      else if ((index === currentIndex - 2 || index === currentIndex - 3) && index >= 0) {
        priority = 6;
      }
      // The rest get low priority
      else {
        priority = 3;
      }
      
      // Add to queue if not already being processed
      if (!this.processingImages.has(url)) {
        this.queue.set(url, {
          priority, 
          productId, 
          index
        });
      }
    });
    
    // Start processing the queue
    this.processQueue();
  },
  
  // Update which image is currently viewed, shifting priorities
  updateCurrentImage(productId, imageIndex) {
    // Find all queued images for this product and update priorities
    for (const [url, info] of this.queue.entries()) {
      if (info.productId === productId) {
        let newPriority = 3; // Default low priority
        
        // Determine new priority based on distance from current image
        const distance = Math.abs(info.index - imageIndex);
        
        if (distance === 0) {
          newPriority = 10; // Current image
        } else if (distance === 1) {
          newPriority = 9; // Adjacent image
        } else if (distance === 2) {
          newPriority = 7; // 2 away
        } else if (distance === 3) {
          newPriority = 5; // 3 away
        } else if (distance <= 5) {
          newPriority = 4; // 4-5 away
        }
        
        // Update priority
        this.queue.set(url, {
          ...info,
          priority: newPriority
        });
      }
    }
    
    // Process queue with updated priorities
    this.processQueue();
  },
  
  // Process the prefetch queue based on priorities
  async processQueue() {
    // Don't start new requests if at concurrency limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }
    
    // Get highest priority items from the queue
    const queueEntries = Array.from(this.queue.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    // Nothing to process
    if (queueEntries.length === 0) {
      return;
    }
    
    // Take the highest priority items that can be processed
    const freeSlots = this.maxConcurrentRequests - this.activeRequests;
    const itemsToProcess = queueEntries.slice(0, freeSlots);
    
    for (const [url, info] of itemsToProcess) {
      // Remove from queue
      this.queue.delete(url);
      
      // Mark as processing
      this.processingImages.add(url);
      
      // Increment active requests
      this.activeRequests++;
      
      // Prefetch the image
      this.prefetchImage(url, info.priority >= 9)
        .finally(() => {
          // Decrement active requests
          this.activeRequests--;
          
          // Remove from processing set
          this.processingImages.delete(url);
          
          // Continue processing queue
          this.processQueue();
        });
    }
  },
  
  // Prefetch and cache a single image
  async prefetchImage(url, isHighPriority = false) {
    try {
      const cache = await caches.open(CACHE_NAMES.IMAGES);
      
      // Check if already cached
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        console.log(`Gallery image already cached: ${url}`);
        return cachedResponse;
      }
      
      console.log(`Prefetching gallery image${isHighPriority ? ' (high priority)' : ''}: ${url}`);
      
      // Create a request object from the URL
      const request = new Request(url);
      
      // Fetch the image with appropriate priority
      const fetchOptions = {
        priority: isHighPriority ? 'high' : 'low',
        timeout: isHighPriority ? 5000 : 3000,
        useNoCorsFallback: true
      };
      
      // Special handling for problematic URLs with dashes 
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('-d') && 
          urlObj.pathname.includes('product-images') &&
          urlObj.pathname.includes('/storage/v1/render/image/public/')) {
        
        const response = await fetchImageWithFallbacks(request, fetchOptions);
        
        if (response && response.type !== 'opaque') {
          await cacheImage(response.clone(), request, cache);
          return response;
        } else if (response) {
          return response;
        }
      } else {
        // Standard approach for non-problematic URLs
        const response = await fetchImageWithFallbacks(request, fetchOptions);
        
        if (response && response.type !== 'opaque') {
          await cacheImage(response.clone(), request, cache);
          return response;
        } else if (response) {
          return response;
        }
      }
      
      // If all attempts failed
      console.warn(`All prefetch attempts failed for gallery image: ${url}`);
      return null;
    } catch (e) {
      console.error(`Error in prefetchImage: ${url}`, e);
      return null;
    }
  }
};

// Specialized handler for LCP image requests - prioritizes speed over freshness
async function handleLcpImageRequest(request) {
  const startTime = Date.now();
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  
  try {
    // Check cache first with a fast path return
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Return cached response immediately
      recordMetric('IMAGES', 'hit', Date.now() - startTime);
      
      // Background update after a delay to not interfere with critical resources
      setTimeout(() => {
        fetchImageWithFallbacks(request)
          .then(response => {
            if (response && response.ok) {
              cacheImage(response, request, cache);
              console.log('Updated LCP image in background');
            }
          })
          .catch(err => console.warn('Background LCP update failed:', err));
      }, 3000);
      
      return cachedResponse;
    }
    
    // No cache hit, try fetch with fallbacks
    console.log('Fetching LCP image:', request.url);
    const response = await fetchImageWithFallbacks(request, {
      timeout: 6000,  // Slightly longer timeout for LCP images
      useNoCorsFallback: true
    });
    
    if (response) {
      // Cache the response if possible
      if (response.type !== 'opaque') {
        await cacheImage(response.clone(), request, cache);
      }
      
      recordMetric('IMAGES', response.type === 'opaque' ? 'opaque' : 'miss', Date.now() - startTime);
      return response;
    }
    
    // If all fetch attempts failed, check cache one more time
    const lastChanceCachedResponse = await cache.match(request);
    if (lastChanceCachedResponse) {
      console.log('Using last-chance cached response for LCP image');
      recordMetric('IMAGES', 'last-chance-hit', Date.now() - startTime);
      return lastChanceCachedResponse;
    }
    
    // If everything fails, return empty response to prevent blocking
    console.error('All LCP image fetch strategies failed');
    recordMetric('IMAGES', 'empty-fallback', Date.now() - startTime);
    return new Response('', {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('LCP image request handler failed:', error);
    recordMetric('IMAGES', 'error', Date.now() - startTime);
    
    // If our handler fails, try basic fetch as last resort
    try {
      return fetch(request);
    } catch (e) {
      // If that also fails, return empty response
      return new Response('', { 
        status: 200, 
        headers: { 'Content-Type': 'image/svg+xml' } 
      });
    }
  }
}

// Specialized handler for product image requests with moderate optimization
async function handleProductImageRequest(request) {
  const startTime = Date.now();
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const url = new URL(request.url);
  
  try {
    // Check for problematic characters in URL
    const hasProblematicChars = url.pathname.includes('(') || 
                                url.pathname.includes(')') || 
                                url.pathname.includes(' ');
    
    // Normalize the URL to ensure it uses the right endpoint based on file type and characters
    if (url.hostname.includes('supabase.co')) {
      // For problematic URLs, always use object endpoint
      if (hasProblematicChars || url.pathname.endsWith('.webp') || url.pathname.includes('-d')) {
        if (url.pathname.includes('/storage/v1/render/image/public/')) {
          // Convert render URL to object URL for problematic files
          const pathMatch = url.pathname.match(/\/storage\/v1\/render\/image\/public\/(.+)/);
          if (pathMatch && pathMatch[1]) {
            const objectPath = pathMatch[1];
            const objectUrl = `${url.protocol}//${url.hostname}/storage/v1/object/public/${objectPath}`;
            
            // Create new request with sanitized URL
            request = new Request(objectUrl.split('?')[0], {
              method: request.method,
              headers: request.headers,
              mode: request.mode,
              credentials: request.credentials,
              redirect: request.redirect
            });
            
            console.log('Converted problematic render URL to object URL:', objectUrl);
          }
        } else if (url.pathname.includes('/storage/v1/object/public/')) {
          // Handle special characters in object URLs
          const pathParts = url.pathname.split('/');
          const fileNameIndex = pathParts.length - 1;
          
          try {
            // Decode first (in case it's already encoded)
            const originalFilename = pathParts[fileNameIndex];
            let decodedFilename;
            try {
              decodedFilename = decodeURIComponent(originalFilename);
            } catch {
              decodedFilename = originalFilename;
            }
            
            // Re-encode properly
            const encodedFilename = encodeURIComponent(decodedFilename)
              .replace(/%20/g, '-')  // Convert spaces to hyphens
              .replace(/%28/g, '')   // Remove opening parentheses
              .replace(/%29/g, '')   // Remove closing parentheses
              .replace(/%2F/g, '-'); // Replace slashes with hyphens
            
            // Replace filename in path if it changed
            if (encodedFilename !== originalFilename) {
              pathParts[fileNameIndex] = encodedFilename;
              const newPathname = pathParts.join('/');
              
              // Create new request with sanitized URL
              request = new Request(`${url.protocol}//${url.hostname}${newPathname}`, {
                method: request.method,
                headers: request.headers,
                mode: request.mode,
                credentials: request.credentials,
                redirect: request.redirect
              });
              
              console.log('Sanitized object URL with special characters');
            }
          } catch (e) {
            console.warn('Error sanitizing object URL:', e);
          }
        }
      } else if (url.pathname.includes('/storage/v1/object/public/') && 
                /\.(jpe?g|png)$/i.test(url.pathname)) {
        // For regular JPG/PNG, convert object to render URL
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
        if (pathMatch && pathMatch[1]) {
          const renderPath = `/storage/v1/render/image/public/${pathMatch[1]}`;
          const renderUrl = `${url.protocol}//${url.hostname}${renderPath}${url.search || '?width=800&quality=80&format=original'}`;
          
          // Create a new request with render URL
          request = new Request(renderUrl, {
            method: request.method,
            headers: request.headers,
            mode: request.mode,
            credentials: request.credentials,
            redirect: request.redirect
          });
          
          console.log('Normalized product image URL to render URL:', renderUrl);
        }
      }
    }
    
    // Check cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      recordMetric('IMAGES', 'hit', Date.now() - startTime);
      return cachedResponse;
    }
    
    // Special handling for problematic product image URLs
    const isProblematicImage = (hasProblematicChars || 
                              url.pathname.includes('-d') || 
                              url.pathname.endsWith('.webp')) && 
                              url.pathname.includes('product-images');
    
    // For all Supabase storage URLs, use our enhanced fetch with fallbacks
    console.log('Fetching product image with fallbacks:', request.url);
    const response = await fetchImageWithFallbacks(request, {
      timeout: 5000
    });
    
    if (response) {
      // Cache the successful response
      if (response.type !== 'opaque') {
        await cacheImage(response.clone(), request, cache);
      }
      
      recordMetric('IMAGES', response.type === 'opaque' ? 'opaque' : 'miss', Date.now() - startTime);
      return response;
    }
    
    // If all fetching strategies fail, but we have a cached response from earlier, use it
    const lastChanceCachedResponse = await cache.match(request);
    if (lastChanceCachedResponse) {
      console.log('Using last-chance cached product image');
      recordMetric('IMAGES', 'last-chance-hit', Date.now() - startTime);
      return lastChanceCachedResponse;
    }
    
    // If we've tried everything and still failed, try a final direct browser fetch
    console.warn('All product image fetch attempts failed, passing to browser');
    recordMetric('IMAGES', 'browser-passthrough', Date.now() - startTime);
    return fetch(request.clone());
  } catch (error) {
    console.error('Product image request error:', error);
    // Last resort - pass through to browser
    return fetch(request);
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

// Listen for message events from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'INVALIDATE_CACHE':
        if (event.data.cacheName && event.data.url) {
          invalidateCacheEntry(event.data.cacheName, event.data.url)
            .then(() => sendMessageToClients({ type: 'INVALIDATED', url: event.data.url }))
            .catch(error => console.error('Failed to invalidate cache:', error));
        }
        break;
        
      case 'CLEAR_ALL_CACHES':
        clearAllCaches()
          .then(() => sendMessageToClients({ type: 'CACHES_CLEARED' }))
          .catch(error => console.error('Failed to clear caches:', error));
        break;
        
      case 'GET_VERSION':
        // Respond with version info to the client that sent the message
        event.ports[0].postMessage({
          type: 'VERSION_INFO',
          version: APP_VERSION
        });
        break;
        
      case 'GET_METRICS':
        // Send cache metrics to client
        event.ports[0].postMessage({
          type: 'METRICS',
          metrics: metrics
        });
        break;

      case 'PRELOAD_PAGE':
        // Preload resources for a specific page type
        if (event.data.pageType && event.data.slug) {
          preloadPageResources(event.data.pageType, event.data.slug)
            .then(() => console.log(`Preloaded resources for ${event.data.pageType} ${event.data.slug}`))
            .catch(error => console.error(`Failed to preload resources: ${error}`));
        }
        break;
        
      case 'PRIORITIZE_IMAGES':
        // Prioritize images with a specific pattern
        if (event.data.pattern) {
          prioritizeImagePattern(event.data.pattern)
            .then(() => console.log(`Prioritized images matching ${event.data.pattern}`))
            .catch(error => console.error(`Failed to prioritize images: ${error}`));
        }
        break;
        
      case 'PREFETCH_GALLERY':
        // Initialize prefetching for a product image gallery
        if (event.data.productId && event.data.imageUrls) {
          GALLERY_PREFETCH.initGallery(
            event.data.productId, 
            event.data.imageUrls, 
            event.data.currentIndex || 0
          ).catch(error => console.error(`Failed to initialize gallery prefetch: ${error}`));
          
          // Send acknowledgment to client
          sendMessageToClients({ 
            type: 'GALLERY_PREFETCH_STARTED', 
            productId: event.data.productId 
          });
        }
        break;
        
      case 'UPDATE_GALLERY_IMAGE':
        // Update which image in a gallery is currently being viewed
        if (event.data.productId !== undefined && event.data.imageIndex !== undefined) {
          GALLERY_PREFETCH.updateCurrentImage(event.data.productId, event.data.imageIndex);
        }
        break;
    }
  }
});

// Preload resources for specific page types
async function preloadPageResources(pageType, slug) {
  try {
    const urls = [];
    
    // Add common API URLs
    if (pageType === 'product') {
      urls.push(`/api/products/${slug}`);
      urls.push(`/api/products/${slug}/variants`);
      urls.push(`/api/products/${slug}/related`);
    } else if (pageType === 'collection') {
      urls.push(`/api/collections/${slug}`);
      urls.push(`/api/collections/${slug}/products`);
      urls.push(`/api/collections/${slug}/categories`);
    }
    
    // Preload each URL with network-first strategy
    for (const url of urls) {
      try {
        const cache = await caches.open(CACHE_NAMES.API);
        const cachedResponse = await cache.match(url);
        
        // Always try to fetch fresh data, fall back to cached
        fetch(url)
          .then(response => {
            if (response.ok) {
              cache.put(url, response.clone());
              return response;
            }
            return cachedResponse || response;
          })
          .catch(() => {
            // Return cached response if available as fallback
            return cachedResponse;
          });
      } catch (err) {
        console.warn(`Failed to preload ${url}:`, err);
      }
    }
  } catch (error) {
    console.error('Error in preloadPageResources:', error);
  }
}

// Prioritize images with a certain pattern by updating their cache headers
async function prioritizeImagePattern(pattern) {
  try {
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const keys = await cache.keys();
    
    // Find matching image URLs
    for (const request of keys) {
      if (request.url.includes(pattern)) {
        try {
          const response = await cache.match(request);
          if (response) {
            // Create a new response with high priority cache headers
            const headers = new Headers(response.headers);
            headers.set('X-Priority', 'high');
            headers.set('Cache-Control', 'public, max-age=86400'); // 1 day cache
            
            const enhancedResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers
            });
            
            // Update the cache with the enhanced response
            await cache.put(request, enhancedResponse);
          }
        } catch (err) {
          console.warn(`Failed to prioritize ${request.url}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Error in prioritizeImagePattern:', error);
  }
}

// Helper function to send messages to all clients
async function sendMessageToClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage(message));
}

// Helper function to invalidate a specific cache entry
async function invalidateCacheEntry(cacheName, url) {
  const cache = await caches.open(cacheName);
  return cache.delete(url);
}

// Helper function to clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(name => caches.delete(name)));
} 