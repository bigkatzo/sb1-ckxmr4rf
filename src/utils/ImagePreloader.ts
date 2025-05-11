// Set to store preloaded image URLs
const preloadedImages = new Set<string>();

// Store loading promises to avoid duplicate loads
const loadingPromises = new Map<string, Promise<void>>();

// Track load times for analytics (in ms)
const loadTimes = new Map<string, number>();

// Maximum number of concurrent loads
const MAX_CONCURRENT_LOADS = 3;

// Preloading priority queue
let preloadQueue: string[] = [];
let activeLoads = 0;

/**
 * Preload an array of image URLs
 * @param urls Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  const uniqueUrls = urls.filter(url => !preloadedImages.has(url) && !loadingPromises.has(url));
  
  // Add to queue with priority
  preloadQueue = [...preloadQueue, ...uniqueUrls];
  
  // Process queue
  processQueue();
  
  // Return promises for all requested URLs
  return Promise.all(urls.map(url => {
    // If already preloaded, return resolved promise
    if (preloadedImages.has(url)) {
      return Promise.resolve();
    }
    
    // If loading, return existing promise
    if (loadingPromises.has(url)) {
      return loadingPromises.get(url)!;
    }
    
    // Create new promise for this URL
    const promise = new Promise<void>((resolve) => {
      // This will be resolved when the image is loaded in processQueue
      const checkInterval = setInterval(() => {
        if (preloadedImages.has(url)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    loadingPromises.set(url, promise);
    return promise;
  }));
}

/**
 * Process the preload queue, respecting concurrency limits
 */
function processQueue(): void {
  if (activeLoads >= MAX_CONCURRENT_LOADS || preloadQueue.length === 0) {
    return;
  }
  
  // Get next URL
  const url = preloadQueue.shift()!;
  activeLoads++;
  
  // Start load timer
  const startTime = performance.now();
  
  const img = new Image();
  
  img.onload = () => {
    // Record load time
    loadTimes.set(url, performance.now() - startTime);
    
    // Mark as preloaded
    preloadedImages.add(url);
    
    // Clean up
    activeLoads--;
    loadingPromises.delete(url);
    
    // Process next item
    processQueue();
  };
  
  img.onerror = () => {
    console.warn(`Failed to preload image: ${url}`);
    
    // Clean up
    activeLoads--;
    loadingPromises.delete(url);
    
    // Process next item
    processQueue();
  };
  
  // Start loading
  img.crossOrigin = "anonymous";
  img.src = url;
}

/**
 * Smart gallery preloading that prioritizes adjacent images
 * Optimized for gallery/carousel UX by preloading nearby images first
 * 
 * @param urls All image URLs in the gallery
 * @param currentIndex Current displayed image index
 * @param range How many images to preload before and after
 */
export function preloadGallery(urls: string[], currentIndex: number, range: number = 2): void {
  if (!urls.length) return;
  
  // Create prioritized list
  const priorityUrls: string[] = [];
  
  // First priority: next image
  if (currentIndex + 1 < urls.length) {
    priorityUrls.push(urls[currentIndex + 1]);
  }
  
  // Second priority: previous image
  if (currentIndex - 1 >= 0) {
    priorityUrls.push(urls[currentIndex - 1]);
  }
  
  // Third priority: remaining images within range
  for (let i = 2; i <= range; i++) {
    if (currentIndex + i < urls.length) {
      priorityUrls.push(urls[currentIndex + i]);
    }
    if (currentIndex - i >= 0) {
      priorityUrls.push(urls[currentIndex - i]);
    }
  }
  
  // Preload with priority
  preloadImages(priorityUrls);
  
  // In idle time, preload the rest of the gallery
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      const remainingUrls = urls.filter(url => 
        !preloadedImages.has(url) && 
        !loadingPromises.has(url) && 
        !priorityUrls.includes(url)
      );
      if (remainingUrls.length) {
        preloadImages(remainingUrls);
      }
    });
  }
}

/**
 * Check if an image URL has been preloaded
 * @param url Image URL to check
 * @returns boolean indicating if the image is preloaded
 */
export function isImagePreloaded(url: string): boolean {
  return preloadedImages.has(url);
}

/**
 * Clear the preloaded images cache
 * Useful when you want to free up memory
 */
export function clearPreloadedImages(): void {
  preloadedImages.clear();
  loadingPromises.clear();
  loadTimes.clear();
  preloadQueue = [];
  activeLoads = 0;
}

/**
 * Get preload statistics for performance monitoring
 */
export function getPreloadStats(): {
  preloadedCount: number;
  loadingCount: number;
  queuedCount: number;
  averageLoadTime: number;
} {
  const loadTimeValues = Array.from(loadTimes.values());
  const averageLoadTime = loadTimeValues.length ? 
    loadTimeValues.reduce((sum, time) => sum + time, 0) / loadTimeValues.length : 
    0;
  
  return {
    preloadedCount: preloadedImages.size,
    loadingCount: activeLoads,
    queuedCount: preloadQueue.length,
    averageLoadTime
  };
}

