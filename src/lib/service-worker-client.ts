/**
 * Handles client-side service worker registration and version checking
 */

// Check for updates when the page becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CHECK_VERSION' });
  }
});

// Register the service worker
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      
      // Check for updates on registration
      if (registration.active) {
        registration.active.postMessage({ type: 'CHECK_VERSION' });
      }

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_VERSION_INSTALLED') {
          console.log('New version available:', event.data.version);
          // You can show a notification to the user here
          if (confirm('A new version is available. Would you like to reload to update?')) {
            window.location.reload();
          }
        }
      });

      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
} 