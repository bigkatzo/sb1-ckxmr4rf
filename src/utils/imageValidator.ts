/**
 * Image URL validation and normalization utilities
 * Simple version to prevent profile image issues
 */

// Simple placeholder SVG for failed images
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMyNDI0MjQiLz48cGF0aCBkPSJNODYgNzVIMTE0Vjg1SDg2Vjc1Wk04NiAxMjVWOTVIMTE0VjEyNUg4NlpNNzQgMTM3SDEyNlY2M0g3NFYxMzdaIiBmaWxsPSIjNDI0MjQyIi8+PC9zdmc+';

/**
 * Normalizes a storage URL to ensure it uses the best endpoint format
 * @param url The URL to normalize
 * @returns The normalized URL
 */
export function normalizeStorageUrl(url: string): string {
  if (!url) return '';
  
  try {
    // For WebP, dash-pattern files, logos, and non-jpg/png files, always use object URL
    const isWebp = url.includes('.webp');
    const hasDashPattern = url.includes('-d');
    const isLogo = url.includes('logo');
    const isPng = url.endsWith('.png');
    const isJpg = url.endsWith('.jpg') || url.endsWith('.jpeg');
    
    if (url.includes('supabase') && url.includes('/storage/v1/')) {
      if (isWebp || hasDashPattern || isLogo || (!isPng && !isJpg)) {
        return url.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
      }
    }
    
    return url;
  } catch (error) {
    console.error('Error normalizing storage URL:', error);
    return url;
  }
}

/**
 * Global error handler for images - simpler version
 */
function imageErrorHandler(event: Event) {
  const target = event.target;
  
  // Only handle image errors
  if (!(target instanceof HTMLImageElement)) return;
  
  // Skip data URLs and already processed URLs
  if (target.src.startsWith('data:') || target.hasAttribute('data-fallback-applied')) return;
  
  // Only handle Supabase URLs
  if (target.src.includes('supabase.co')) {
    console.warn('Handling image error:', target.src);
    
    // For render URLs, try object URL
    if (target.src.includes('/storage/v1/render/image/public/')) {
      // Mark as processed
      target.setAttribute('data-fallback-applied', 'true');
      
      // Switch to object URL
      const objectUrl = target.src
        .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/')
        .split('?')[0]; // Remove query params
      
      console.log('Switching to object URL:', objectUrl);
      target.src = objectUrl;
    } 
    // If object URL also fails, use placeholder
    else if (target.src.includes('/storage/v1/object/public/') && target.hasAttribute('data-fallback-applied')) {
      console.warn('Object URL also failed, using placeholder');
      target.src = PLACEHOLDER_IMAGE;
    }
  }
}

/**
 * Fix for image elements that are already on the page
 */
export function fixAllImages() {
  if (typeof document === 'undefined') return;
  
  // Set up global error handler
  document.removeEventListener('error', imageErrorHandler, true);
  document.addEventListener('error', imageErrorHandler, true);
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
}

/**
 * Validates an image URL and returns a normalized version or placeholder
 * @param url The URL to validate
 * @returns The validated and normalized URL, or a placeholder for invalid URLs
 */
export function validateImageUrl(url: string): string {
  if (!url) return PLACEHOLDER_IMAGE;
  
  try {
    // Normalize the URL first
    const normalizedUrl = normalizeStorageUrl(url);
    
    // Basic URL validation
    new URL(normalizedUrl);
    
    return normalizedUrl;
  } catch (error) {
    console.error('Invalid image URL:', error);
    return PLACEHOLDER_IMAGE;
  }
}

// Initialize on page load if we're in the browser
if (typeof window !== 'undefined') {
  // Run immediately if document is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fixAllImages();
  } else {
    // Otherwise wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', fixAllImages);
  }
} 