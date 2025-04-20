/**
 * Image URL validation and normalization utilities
 * Ensures all Supabase images use render endpoints instead of object endpoints
 */

// Store successful image URLs to avoid "fixing" what isn't broken
const successfulImageUrls = new Set<string>();

// Track which URLs have been tried to prevent infinite loops
const attemptedUrls = new Set<string>();
const failedUrls = new Set<string>();

// Track which URLs work and which need fallback
const successfulUrlMap = new Map<string, string>(); // originalUrl -> workingUrl

// Simple base64 encoded placeholder image for completely failed images
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMyNDI0MjQiLz48cGF0aCBkPSJNODYgNzVIMTE0Vjg1SDg2Vjc1Wk04NiAxMjVWOTVIMTE0VjEyNUg4NlpNNzQgMTM3SDEyNlY2M0g3NFYxMzdaIiBmaWxsPSIjNDI0MjQyIi8+PC9zdmc+';

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
    // Early detection for WebP or problematic dash patterns
    const isWebp = url.includes('.webp');
    const hasDashPattern = url.includes('-d');
    
    // For these problematic formats, always use object URL
    if (isWebp || hasDashPattern) {
      if (url.includes('/storage/v1/render/image/public/')) {
        const objectUrl = url
          .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
          .split('?')[0]; // Remove query params
          
        return objectUrl;
      }
      
      // If it's already an object URL, leave it alone
      return url;
    }
    
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
    
    // If it's an object URL, convert it to a render URL for certain formats
    if (path.includes('/storage/v1/object/public/')) {
      // Only convert JPG and PNG which are better supported
      const isJpgOrPng = /\.(jpe?g|png)$/i.test(path);
      
      if (isJpgOrPng) {
        // Convert to render URL for images
        path = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        
        // Add required parameters for better compatibility
        const params = new URLSearchParams(parsedUrl.search);
        if (!params.has('width')) params.append('width', '800');
        if (!params.has('quality')) params.append('quality', '80');
        params.append('format', 'original');
        
        // Create final URL
        return `${parsedUrl.protocol}//${parsedUrl.host}${path}?${params.toString()}`;
      } else {
        // For other formats, return as is
        return url;
      }
    }
    
    // For other URLs, return as is
    return url;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url;
  }
}

/**
 * Global error handler for images
 */
function imageErrorHandler(event: Event) {
  const target = event.target;
  
  // Only handle image errors
  if (!(target instanceof HTMLImageElement)) return;
  
  // Avoid handling the same URL multiple times
  if (attemptedUrls.has(target.src)) return;
  
  // Skip data URLs
  if (target.src.startsWith('data:')) return;
  
  // Mark this URL as attempted
  attemptedUrls.add(target.src);
  
  // Only handle Supabase URLs
  if (target.src.includes('supabase.co')) {
    console.warn('Fixing broken image:', target.src);
    
    // If URL is already known to fail completely, use placeholder
    if (failedUrls.has(target.src)) {
      target.src = PLACEHOLDER_IMAGE;
      return;
    }
    
    // For render URLs, try object URL
    if (target.src.includes('/storage/v1/render/image/public/')) {
      const objectUrl = target.src
        .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
        .split('?')[0]; // Remove query params
      
      // If we've already tried this URL, use placeholder
      if (attemptedUrls.has(objectUrl) || failedUrls.has(objectUrl)) {
        failedUrls.add(target.src);
        target.src = PLACEHOLDER_IMAGE;
        return;
      }
      
      // Mark object URL as attempted
      attemptedUrls.add(objectUrl);
      
      // Add final fallback
      target.onerror = () => {
        if (!target.src.startsWith('data:')) {
          failedUrls.add(objectUrl);
          target.src = PLACEHOLDER_IMAGE;
        }
      };
      
      // Try object URL
      target.src = objectUrl;
    }
    // For already failed object URLs, use placeholder
    else if (target.src.includes('/storage/v1/object/public/')) {
      failedUrls.add(target.src);
      target.src = PLACEHOLDER_IMAGE;
    }
  }
}

/**
 * Fix for image elements that are already on the page
 * This catches any broken images and forces them to use object URLs instead of render URLs
 */
export function fixAllImages() {
  if (typeof document === 'undefined') return;
  
  // Clear tracking sets to prevent stale data
  attemptedUrls.clear();
  
  // Fix existing images on the page
  document.querySelectorAll('img').forEach(img => {
    if (!img.src || attemptedUrls.has(img.src)) return;
    
    // Track that we've tried to fix this URL
    attemptedUrls.add(img.src);
    
    // Only try to fix Supabase URLs that aren't already successful
    if (img.src.includes('supabase.co') && !successfulImageUrls.has(img.src)) {
      const isWebp = img.src.includes('.webp');
      const hasDashPattern = img.src.includes('-d');
      
      // For problematic formats using render endpoint, convert to object URL
      if ((isWebp || hasDashPattern) && img.src.includes('/storage/v1/render/image/')) {
        const objectUrl = img.src
          .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
          .split('?')[0]; // Remove query params
        
        console.log('Fixing problematic image format:', objectUrl);
        
        // Add error handler for absolute last resort
        img.onerror = () => {
          if (!img.src.startsWith('data:')) {
            // Remember this URL has completely failed
            failedUrls.add(img.src);
            // Use placeholder as last resort
            console.error('Image completely failed, using placeholder:', img.src);
            img.src = PLACEHOLDER_IMAGE;
          }
        };
        
        // Mark this URL as attempted
        attemptedUrls.add(objectUrl);
        
        // Apply the fix
        img.src = objectUrl;
      }
      
      // Add handlers for successful loads
      img.onload = () => {
        successfulImageUrls.add(img.src);
      };
    }
  });
  
  // Set up global error handler for future images
  document.removeEventListener('error', imageErrorHandler, true);
  document.addEventListener('error', imageErrorHandler, true);
  
  // Make sure we only call this once
  if (typeof window !== 'undefined') {
    (window as any).__EMERGENCY_IMAGE_FIX_APPLIED = true;
  }
}

/**
 * Initialize image handling for the app
 */
export function initializeImageHandling() {
  if (typeof window === 'undefined') return;
  
  // Apply fixes on load
  if (document.readyState === 'complete') {
    fixAllImages();
  } else {
    window.addEventListener('load', fixAllImages);
  }
  
  // Re-apply on navigation
  window.addEventListener('popstate', fixAllImages);
  
  // Set up global error handler with a small delay to ensure DOM is ready
  setTimeout(() => {
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
          if (successfulUrlMap.has(originalSrc)) {
            fixedUrl = successfulUrlMap.get(originalSrc) || originalSrc;
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
              successfulUrlMap.set(originalSrc, fixedUrl);
              
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
  }, 500);
}

/**
 * Function for components to use when displaying images
 * Ensures the URL will display properly based on past experience and file type
 */
export function validateImageUrl(url: string): string {
  if (!url) return '';
  
  // If URL has already failed, use placeholder
  if (failedUrls.has(url)) {
    return PLACEHOLDER_IMAGE;
  }
  
  // If we already know this URL works as a different URL, use that one
  if (successfulUrlMap.has(url)) {
    return successfulUrlMap.get(url) || url;
  }
  
  // For WebP or dash-pattern files, always use object URL
  const isWebp = url.includes('.webp');
  const hasDashPattern = url.includes('-d');
  
  if ((isWebp || hasDashPattern) && url.includes('/storage/v1/render/image/public/')) {
    const objectUrl = url
      .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
      .split('?')[0];
      
    // Remember this conversion
    successfulUrlMap.set(url, objectUrl);
    
    return objectUrl;
  }
  
  // Otherwise use normal URL normalization
  return normalizeStorageUrl(url);
}

// Initialize on page load if we're in the browser
if (typeof window !== 'undefined' && !(window as any).__EMERGENCY_IMAGE_FIX_APPLIED) {
  // Run immediately if document is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fixAllImages();
  } else {
    // Otherwise wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', fixAllImages);
  }
  
  // Also run on any navigation changes for SPAs
  window.addEventListener('popstate', fixAllImages);
}

/**
 * Scans the document for Supabase images and fixes any that are using object endpoints
 * @returns The number of images fixed
 */
export function validateImages(): number {
  let fixedCount = 0;
  
  if (typeof document === 'undefined') return fixedCount;
  
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
 * Setup automatic validation for the entire app
 * This should be called once during app initialization
 */
export function setupImageValidation(): void {
  if (typeof document === 'undefined') return;
  
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