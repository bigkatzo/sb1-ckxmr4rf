// Set to store preloaded image URLs
const preloadedImages = new Set<string>();

/**
 * Preload an array of image URLs
 * @param urls Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  const uniqueUrls = urls.filter(url => !preloadedImages.has(url));
  
  const loadPromises = uniqueUrls.map(url => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        preloadedImages.add(url);
        resolve();
      };
      
      img.onerror = () => {
        // Don't reject, just resolve to avoid breaking the Promise.all
        console.warn(`Failed to preload image: ${url}`);
        resolve();
      };
      
      img.src = url;
    });
  });
  
  return Promise.all(loadPromises);
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
} 