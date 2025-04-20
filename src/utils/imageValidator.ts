/**
 * Image URL validation and normalization utilities
 * Ensures all Supabase images use render endpoints instead of object endpoints
 */

/**
 * Normalizes a storage URL to ensure it uses the render endpoint
 * @param url The URL to normalize
 * @returns The normalized URL
 */
export function normalizeStorageUrl(url: string): string {
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
  
  document.querySelectorAll('img[src*="supabase"]').forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.includes('/storage/v1/object/public/')) {
      const normalizedSrc = normalizeStorageUrl(src);
      img.setAttribute('src', normalizedSrc);
      
      // Log the fix
      console.warn('Fixed image with object URL:', { original: src, fixed: normalizedSrc });
      fixedCount++;
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
  
  container.querySelectorAll('img[src*="supabase"]').forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.includes('/storage/v1/object/public/')) {
      const normalizedSrc = normalizeStorageUrl(src);
      img.setAttribute('src', normalizedSrc);
      
      // Log the fix
      console.warn('Fixed container image with object URL:', { original: src, fixed: normalizedSrc });
      fixedCount++;
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
  
  // Validate periodically to catch dynamically loaded images
  setInterval(() => {
    const fixedCount = validateImages();
    if (fixedCount > 0) {
      console.warn(`Fixed ${fixedCount} images during periodic check`);
    }
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
          const fixedCount = validateImages();
          if (fixedCount > 0) {
            console.warn(`Fixed ${fixedCount} images after DOM changes`);
          }
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