// Queue for managing image preloading
class PreloadQueue {
  private queue: string[] = [];
  private loading: Set<string> = new Set();
  private maxConcurrent: number = 3;
  private preloadedUrls: Set<string> = new Set();

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  add(urls: string[]) {
    // Filter out already preloaded or loading URLs
    const newUrls = urls.filter(url => 
      !this.preloadedUrls.has(url) && !this.loading.has(url)
    );
    
    this.queue.push(...newUrls);
    this.processQueue();
  }

  private async processQueue() {
    if (this.loading.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const url = this.queue.shift();
    if (!url) return;

    this.loading.add(url);

    try {
      // Create a priority-aware request
      const preloadRequest = new Request(url, {
        headers: {
          'X-Image-Priority': 'low',
          'X-Viewport-Visible': 'false'
        }
      });

      // Fetch the image
      const response = await fetch(preloadRequest);
      if (response.ok) {
        this.preloadedUrls.add(url);
      }
    } catch (error) {
      console.error('Failed to preload image:', url, error);
    } finally {
      this.loading.delete(url);
      this.processQueue();
    }
  }

  isPreloaded(url: string): boolean {
    return this.preloadedUrls.has(url);
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