/**
 * Service Worker registration and management
 */

import { cacheManager } from './cache';

// Cache names used in the service worker
export const CACHE_NAMES = {
  STATIC: 'storedot-static-v1',
  API: 'storedot-api-v1',
  IMAGE: 'storedot-images-v1'
};

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  console.warn('Service Workers are not supported in this browser');
  return null;
}

/**
 * Check if a service worker update is available and prompt user to update
 */
export function checkForUpdates(registration: ServiceWorkerRegistration): void {
  // Check for updates every hour
  setInterval(() => {
    registration.update().catch(err => {
      console.error('Error checking for Service Worker updates:', err);
    });
  }, 60 * 60 * 1000);

  // When a new service worker is available
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker is installed but waiting to activate
        // Show a notification to the user
        if (confirm('A new version of this app is available. Reload to update?')) {
          // Tell the service worker to skipWaiting
          newWorker.postMessage({ type: 'SKIP_WAITING' });
          // Reload the page to activate the new service worker
          window.location.reload();
        }
      }
    });
  });
}

/**
 * Invalidate a specific URL in the service worker cache
 */
export function invalidateUrl(url: string, cacheName = CACHE_NAMES.API): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'INVALIDATE_CACHE',
      cacheName,
      url
    });
  }
}

/**
 * Invalidate all URLs with a specific prefix in the service worker cache
 */
export function invalidateUrlsByPrefix(prefix: string): void {
  // First invalidate in the in-memory cache
  cacheManager.invalidateByPrefix(prefix);
  
  // Then try to invalidate in the service worker cache
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Get all cache keys from the in-memory cache that match the prefix
    // and invalidate them in the service worker cache
    const cacheKeys = cacheManager.getKeysByPrefix(prefix);
    
    cacheKeys.forEach(key => {
      // Determine which cache to use based on the key
      let cacheName = CACHE_NAMES.API;
      if (key.includes('image:') || key.includes('product_image:')) {
        cacheName = CACHE_NAMES.IMAGE;
      }
      
      // Convert cache key to URL
      const url = keyToUrl(key);
      if (url) {
        invalidateUrl(url, cacheName);
      }
    });
  }
}

/**
 * Convert a cache key to a URL for service worker invalidation
 */
function keyToUrl(key: string): string | null {
  // Extract the URL part from the cache key
  // This is a simplified example - adjust based on your actual key format
  if (key.startsWith('api:')) {
    return `/api/${key.substring(4)}`;
  }
  if (key.startsWith('product:')) {
    return `/api/products/${key.substring(8)}`;
  }
  if (key.startsWith('collection:')) {
    return `/api/collections/${key.substring(11)}`;
  }
  
  // For other keys, return null
  return null;
}

/**
 * Setup service worker and return the registration
 */
export async function setupServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const registration = await registerServiceWorker();
  
  if (registration) {
    checkForUpdates(registration);
    
    // Listen for controllerchange events
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
    });
  }
  
  return registration;
} 