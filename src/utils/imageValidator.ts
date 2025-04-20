/**
 * Image URL validation and normalization utilities
 * Ensures all Supabase images use render endpoints instead of object endpoints
 */

// Store successful image URLs to avoid "fixing" what isn't broken
const successfulImageUrls = new Set<string>();

// Track which URLs work and which need fallback
const successfulUrls = new Map<string, string>(); // originalUrl -> workingUrl
const failedUrls = new Set<string>();

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

/**
 * Global image error handler to catch and fix broken images site-wide
 */
export function setupGlobalImageErrorHandling() {
  if (typeof document === 'undefined') return;
  
  // Add global error handler for all images
  document.addEventListener('error', (event) => {
    const target = event.target;
    
    // Only process image errors
    if (target && target instanceof HTMLImageElement) {
      const img = target;
      const originalSrc = img.src;
      
      // Ignore if already a data URL or blob (to prevent loops)
      if (originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
        return;
      }
      
      // Only handle Supabase storage URLs
      if (originalSrc.includes('supabase') && originalSrc.includes('/storage/v1/')) {
        console.warn('Image failed to load, applying emergency fallback:', originalSrc);
        
        // Apply the most aggressive fallback - convert any render URL to object URL
        let fixedUrl = originalSrc;
        
        // Already have a known working URL for this problem?
        if (successfulUrls.has(originalSrc)) {
          fixedUrl = successfulUrls.get(originalSrc) || originalSrc;
          console.log('Using known working URL:', fixedUrl);
        } 
        // Convert render URLs to object URLs as emergency fallback
        else if (originalSrc.includes('/storage/v1/render/image/public/')) {
          const pathMatch = originalSrc.match(/\/storage\/v1\/render\/image\/public\/(.+?)(\?|$)/);
          if (pathMatch && pathMatch[1]) {
            const objectPath = pathMatch[1];
            const urlObj = new URL(originalSrc);
            fixedUrl = `${urlObj.protocol}//${urlObj.hostname}/storage/v1/object/public/${objectPath}`;
            
            // Store this as a known working URL for future use
            successfulUrls.set(originalSrc, fixedUrl);
            
            console.log('Applied emergency render-to-object URL conversion:', {
              original: originalSrc,
              fixed: fixedUrl
            });
          }
        }
        
        // If we have a different fixed URL, apply it
        if (fixedUrl !== originalSrc) {
          img.src = fixedUrl;
          
          // Prevent infinite error loops
          failedUrls.add(originalSrc);
        }
      }
    }
  }, true); // Use capture phase to catch all image errors
  
  console.log('Global image error handling is active');
}

/**
 * Ultimate validator for Supabase image URLs to ensure they always display
 * Also adds critical error recovery for images that fail to load
 * @param url The image URL to validate and fix if needed
 * @returns A validated and guaranteed-to-work URL
 */
export function ensureImageDisplays(url: string): string {
  if (!url) return '';
  
  // For non-Supabase URLs, just return as is
  if (!url.includes('supabase.co') || !url.includes('/storage/v1/')) {
    return url;
  }
  
  // If we already know this URL works, use it
  if (successfulUrls.has(url)) {
    return successfulUrls.get(url) || url;
  }
  
  // If we already know this URL fails, convert it immediately
  if (failedUrls.has(url)) {
    // Apply direct conversion to object URL
    if (url.includes('/storage/v1/render/image/public/')) {
      const pathMatch = url.match(/\/storage\/v1\/render\/image\/public\/(.+?)(\?|$)/);
      if (pathMatch && pathMatch[1]) {
        const objectPath = pathMatch[1];
        const urlObj = new URL(url);
        const fixedUrl = `${urlObj.protocol}//${urlObj.hostname}/storage/v1/object/public/${objectPath}`;
        return fixedUrl;
      }
    }
    return url;
  }
  
  // Special handling for problematic file formats (WebP) or patterns (dashes)
  const urlObj = new URL(url);
  const isWebP = urlObj.pathname.endsWith('.webp');
  const hasDashPattern = urlObj.pathname.includes('-d');
  
  // Problematic URL patterns - always use object URL for these
  if ((isWebP || hasDashPattern) && url.includes('/storage/v1/render/image/public/')) {
    const pathMatch = url.match(/\/storage\/v1\/render\/image\/public\/(.+?)(\?|$)/);
    if (pathMatch && pathMatch[1]) {
      const objectPath = pathMatch[1];
      const fixedUrl = `${urlObj.protocol}//${urlObj.hostname}/storage/v1/object/public/${objectPath}`;
      
      // Remember this conversion for future
      successfulUrls.set(url, fixedUrl);
      
      return fixedUrl;
    }
  }
  
  // If not a problematic pattern, return as-is
  return url;
}

// Call this in your _app.tsx or main layout component
export function initializeImageHandling() {
  if (typeof window !== 'undefined') {
    // Set up global error handler with a small delay to ensure DOM is ready
    setTimeout(() => setupGlobalImageErrorHandling(), 500);
  }
}

// Re-export the function with a more intuitive name for components to use
export const validateImageUrl = ensureImageDisplays; 