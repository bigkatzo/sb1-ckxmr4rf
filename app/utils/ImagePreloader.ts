// Queue for managing image preloading
class PreloadQueue {
  private queue: string[] = [];
  private loading: Set<string> = new Set();
  private maxConcurrent: number = 3;
  private preloadedUrls: Set<string> = new Set();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = Math.min(Math.max(1, maxConcurrent), 6); // Limit between 1 and 6
  }

  add(urls: string[]) {
    // Filter out already preloaded or loading URLs
    const newUrls = urls.filter(url => 
      !this.preloadedUrls.has(url) && !this.loading.has(url)
    );
    
    // Add to queue and start processing
    this.queue.push(...newUrls);
    this.processQueue();
  }

  clear() {
    // Cancel any ongoing requests
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
    this.queue = [];
    this.loading.clear();
  }

  private async processQueue() {
    if (this.loading.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const url = this.queue.shift();
    if (!url) return;

    this.loading.add(url);
    const controller = new AbortController();
    this.abortControllers.set(url, controller);

    try {
      // Create a priority-aware request
      const preloadRequest = new Request(getPrioritizedImageUrl(url, 'low', false), {
        signal: controller.signal
      });

      // Fetch the image
      const response = await fetch(preloadRequest);
      if (response.ok) {
        this.preloadedUrls.add(url);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Preload aborted:', url);
      } else {
        console.error('Failed to preload image:', url, error);
      }
    } finally {
      this.loading.delete(url);
      this.abortControllers.delete(url);
      this.processQueue();
    }
  }

  isPreloaded(url: string): boolean {
    return this.preloadedUrls.has(url);
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      loading: this.loading.size,
      preloaded: this.preloadedUrls.size
    };
  }
}

// Singleton instance
const preloader = new PreloadQueue();

export function preloadImages(urls: string[]) {
  preloader.add(urls);
}

export function isImagePreloaded(url: string): boolean {
  return preloader.isPreloaded(url);
}

export function clearPreloadQueue() {
  preloader.clear();
}

export function getPreloadStats() {
  return preloader.getStats();
}

// Helper function to prepare image URLs with priority parameters
export function getPrioritizedImageUrl(url: string, priority: 'high' | 'low' = 'low', isVisible: boolean = false): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set('priority', priority);
    urlObj.searchParams.set('visible', isVisible.toString());
    return urlObj.toString();
  } catch (e) {
    console.error('Failed to parse URL:', e);
    return url;
  }
} 