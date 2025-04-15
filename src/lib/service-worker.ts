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
      // Check if service worker file exists
      try {
        const response = await fetch('/service-worker.js', { 
          method: 'HEAD',
          cache: 'no-store'
        });
        if (!response.ok) {
          console.error('Service Worker file not found:', response.status);
          return null;
        }
      } catch (fetchError) {
        console.error('Error checking Service Worker:', fetchError);
        return null;
      }

      // Register the service worker
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      // Set up update handling
      handleServiceWorkerUpdate(registration);
      
      // Listen for messages
      listenForServiceWorkerMessages();

      // Don't check for updates immediately
      // Let it happen naturally on page refresh

      console.log('Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  console.warn('Service Workers not supported');
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
 * Preload critical resources for product and collection pages
 */
export function preloadPageResources(type: 'product' | 'collection', slug: string): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PRELOAD_PAGE',
      pageType: type,
      slug: slug
    });
    
    // Also tell the service worker to prioritize product images
    if (type === 'product') {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRIORITIZE_IMAGES',
        pattern: `product-images/${slug}`
      });
    } else if (type === 'collection') {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRIORITIZE_IMAGES',
        pattern: `collection-images/${slug}`
      });
    }
  }
}

/**
 * Prefetch an entire product image gallery to optimize user experience
 * This function initializes progressive prefetching of all gallery images
 * with intelligent prioritization based on the current viewing position
 * 
 * @param productId Unique identifier for the product
 * @param imageUrls Array of all image URLs in the gallery
 * @param currentIndex The index of the image currently being viewed
 * @returns boolean indicating whether the prefetch was initiated
 */
export function prefetchGallery(
  productId: string | number,
  imageUrls: string[],
  currentIndex: number = 0
): boolean {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }
  
  if (!productId || !imageUrls || !imageUrls.length) {
    return false;
  }
  
  navigator.serviceWorker.controller.postMessage({
    type: 'PREFETCH_GALLERY',
    productId: productId.toString(),
    imageUrls,
    currentIndex
  });
  
  return true;
}

/**
 * Update the current viewing position in a product gallery
 * This allows the service worker to adjust prefetching priorities
 * based on the user's current position in the gallery
 * 
 * @param productId Unique identifier for the product
 * @param imageIndex The index of the image currently being viewed
 * @returns boolean indicating whether the update was sent
 */
export function updateGalleryImage(
  productId: string | number,
  imageIndex: number
): boolean {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return false;
  }
  
  if (productId === undefined || imageIndex === undefined) {
    return false;
  }
  
  navigator.serviceWorker.controller.postMessage({
    type: 'UPDATE_GALLERY_IMAGE',
    productId: productId.toString(),
    imageIndex
  });
  
  return true;
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

// Handle service worker updates in a non-intrusive way
function handleServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // Log for developers
        console.log('New version is available and will be used on next refresh');
        
        // Show a subtle notification
        showUpdateNotification();
      }
    });
  });
}

// Show a non-intrusive update notification
function showUpdateNotification() {
  // Try browser notification first
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Update Available', {
        body: 'A new version will be used when you refresh the page',
        icon: '/favicon.ico',
        silent: true, // Don't make a sound
        tag: 'version-update' // Prevent multiple notifications
      });
    } else if (Notification.permission !== 'denied') {
      // Request permission if not denied before
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showUpdateNotification();
        }
      });
    }
  }
}

// Listen for messages from service worker
function listenForServiceWorkerMessages() {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
      const { version } = event.data;
      
      // Log for developers
      console.log(`New version ${version} is available and will be used on next refresh`);
      
      // Show notification about the update
      showUpdateNotification();
    }
  });
}

/**
 * Force invalidate all caches and reload the service worker
 */
export async function forceRefreshServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      // Get all service worker registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      // Unregister all service workers
      await Promise.all(registrations.map(registration => registration.unregister()));
      
      // Clear all caches
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      
      // Reload the page to register new service worker
      window.location.reload();
    } catch (error) {
      console.error('Error forcing service worker refresh:', error);
    }
  }
}

/**
 * Force clear all caches without reloading
 */
export async function forceClearCaches(): Promise<void> {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      // Send message to service worker to clear all caches
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_ALL_CACHES'
      });
      
      // Also clear caches directly
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      
      console.log('All caches cleared successfully');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }
}

/**
 * Get the current service worker version
 */
export async function getCurrentVersion(): Promise<string | null> {
  const controller = navigator.serviceWorker?.controller;
  if ('serviceWorker' in navigator && controller) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'VERSION_INFO') {
          resolve(event.data.version);
        }
      };
      
      controller.postMessage({
        type: 'GET_VERSION'
      }, [channel.port2]);
    });
  }
  return null;
}

// Expose cache control functions globally for debugging
declare global {
  interface Window {
    __DEBUG_SW__: {
      forceRefreshServiceWorker: typeof forceRefreshServiceWorker;
      forceClearCaches: typeof forceClearCaches;
      invalidateUrl: typeof invalidateUrl;
      invalidateUrlsByPrefix: typeof invalidateUrlsByPrefix;
      getCurrentVersion: typeof getCurrentVersion;
      prefetchGallery: typeof prefetchGallery;
      updateGalleryImage: typeof updateGalleryImage;
    };
  }
}

// Only expose in non-production or with debug flag
if (import.meta.env.DEV || localStorage.getItem('debug_sw')) {
  window.__DEBUG_SW__ = {
    forceRefreshServiceWorker,
    forceClearCaches,
    invalidateUrl,
    invalidateUrlsByPrefix,
    getCurrentVersion,
    prefetchGallery,
    updateGalleryImage
  };
} 