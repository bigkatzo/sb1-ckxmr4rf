/**
 * Image URL validation and normalization utilities
 * Ensures all Supabase images use render endpoints instead of object endpoints
 */

// Store successful image URLs to avoid "fixing" what isn't broken
const successfulImageUrls = new Set<string>();

/**
 * Normalizes a storage URL to ensure it uses the render endpoint
 * @param url The URL to normalize
 * @returns The normalized URL
 */
export function normalizeStorageUrl(url: string): string {
  // If this URL has already loaded successfully, don't change it
  if (successfulImageUrls.has(url)) {
    return url;
  }
  
  if (!url) return '';
  
  try {
    // Parse the URL to handle it properly
    const parsedUrl = new URL(url);
    
    // Ensure HTTPS
    parsedUrl.protocol = 'https:';
    
    // Get the path
    let path = parsedUrl.pathname;
    
    // If it's already a render/image URL, don't modify it
    if (path.includes('/storage/v1/render/image/')) {
      return url;
    }
    
    // If it's an object URL, convert it to a render URL for images
    if (path.includes('/storage/v1/object/public/')) {
      // Convert to render URL for images
      path = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      return `${parsedUrl.protocol}//${parsedUrl.host}${path}${parsedUrl.search}`;
    }
    
    // For other URLs, return as is
    return url;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    
    // If URL parsing fails but it looks like a Supabase storage URL, try a simple string replace
    if (typeof url === 'string' && url.includes('/storage/v1/object/public/')) {
      return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    }
    
    // Otherwise return the original URL
    return url;
  }
}

/**
 * Scans the document for Supabase images and fixes any that are using object endpoints
 * @returns The number of images fixed
 */
export function validateImages(): number {
  let fixedCount = 0;
  
  document.querySelectorAll('img[src*="supabase"]').forEach(element => {
    // Cast element to HTMLImageElement
    const img = element as HTMLImageElement;
    const src = img.src;
    if (!src) return;
    
    // Mark loaded images as successful to prevent cycles
    if (img.complete && img.naturalWidth !== 0) {
      successfulImageUrls.add(src);
    }
    
    // Only fix images that aren't already in our success list
    if (src.includes('/storage/v1/object/public/') && !successfulImageUrls.has(src)) {
      const normalizedSrc = normalizeStorageUrl(src);
      img.src = normalizedSrc;
      
      // Log the fix
      console.warn('Fixed image with object URL:', { original: src, fixed: normalizedSrc });
      fixedCount++;
      
      // Listen for load events on this image
      img.addEventListener('load', () => {
        // If it loads successfully, add the URL to our success set
        successfulImageUrls.add(img.src);
        console.log('Image loaded successfully:', img.src);
      });
      
      // Listen for error events on this image
      img.addEventListener('error', () => {
        // If render URL fails, revert to object URL
        if (img.src.includes('/storage/v1/render/image/public/')) {
          const objectUrl = img.src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
          console.warn('Render URL failed, reverting to object URL:', objectUrl);
          img.src = objectUrl;
          // Mark this object URL as successful
          successfulImageUrls.add(objectUrl);
        }
      });
    }
  });
  
  return fixedCount;
}

/**
 * Validates specific image elements from a container
 * Useful for validating dynamically loaded content
 * @param container The container element to search within
 * @returns The number of images fixed
 */
export function validateContainerImages(container: HTMLElement): number {
  let fixedCount = 0;
  
  if (!container) return 0;
  
  container.querySelectorAll('img[src*="supabase"]').forEach(element => {
    // Cast element to HTMLImageElement
    const img = element as HTMLImageElement;
    const src = img.src;
    if (!src) return;
    
    // Mark loaded images as successful to prevent cycles
    if (img.complete && img.naturalWidth !== 0) {
      successfulImageUrls.add(src);
    }
    
    // Only fix images that aren't already in our success list
    if (src.includes('/storage/v1/object/public/') && !successfulImageUrls.has(src)) {
      const normalizedSrc = normalizeStorageUrl(src);
      img.src = normalizedSrc;
      
      // Log the fix
      console.warn('Fixed container image with object URL:', { original: src, fixed: normalizedSrc });
      fixedCount++;
      
      // Add event listeners for this image
      img.addEventListener('load', () => {
        successfulImageUrls.add(img.src);
        console.log('Container image loaded successfully:', img.src);
      });
      
      img.addEventListener('error', () => {
        if (img.src.includes('/storage/v1/render/image/public/')) {
          const objectUrl = img.src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
          console.warn('Render URL failed, reverting to object URL:', objectUrl);
          img.src = objectUrl;
          successfulImageUrls.add(objectUrl);
        }
      });
    }
  });
  
  return fixedCount;
}

/**
 * Setup automatic validation for the entire app
 * This should be called once during app initialization
 */
export function setupImageValidation(): void {
  // Validate on page load
  document.addEventListener('DOMContentLoaded', () => {
    const fixedCount = validateImages();
    if (fixedCount > 0) {
      console.warn(`Fixed ${fixedCount} images on initial page load`);
    }
  });
  
  // Add global error handler for images to auto-revert to object URLs
  document.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG' && target.getAttribute('src')?.includes('/storage/v1/render/image/public/')) {
      const img = target as HTMLImageElement;
      const objectUrl = img.src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
      console.warn('Image error detected, reverting to object URL:', objectUrl);
      img.src = objectUrl;
      successfulImageUrls.add(objectUrl);
      event.preventDefault();
    }
  }, true);
  
  // Single periodic check to catch any remaining issues, but reduce frequency
  setTimeout(() => {
    validateImages();
  }, 3000);
  
  // Listen for DOM changes to catch newly added images
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      // Check if any mutations add nodes
      const hasAddedNodes = mutations.some(mutation => 
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );
      
      if (hasAddedNodes) {
        // Delay slightly to allow React to finish rendering
        setTimeout(() => {
          validateImages();
        }, 100);
      }
    });
    
    // Start observing the document body for DOM changes
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
} 