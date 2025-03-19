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