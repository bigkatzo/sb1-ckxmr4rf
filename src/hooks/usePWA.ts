import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  hasServiceWorker: boolean;
  canInstall: boolean;
  displayMode: 'standalone' | 'browser' | 'minimal-ui' | 'fullscreen';
  deferredPrompt: BeforeInstallPromptEvent | null;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isOnline: navigator.onLine,
    hasServiceWorker: false,
    canInstall: false,
    displayMode: 'browser',
    deferredPrompt: null
  });

  // Check if app is installed
  const checkInstallStatus = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    
    let displayMode: PWAState['displayMode'] = 'browser';
    if (isStandalone) displayMode = 'standalone';
    else if (isMinimalUI) displayMode = 'minimal-ui';
    else if (isFullscreen) displayMode = 'fullscreen';

    setState(prev => ({
      ...prev,
      isInstalled: isStandalone,
      displayMode
    }));
  }, []);

  // Check service worker status
  const checkServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      setState(prev => ({
        ...prev,
        hasServiceWorker: !!registration
      }));
    }
  }, []);

  // Install the PWA
  const installPWA = useCallback(async () => {
    if (!state.deferredPrompt) {
      console.warn('No install prompt available');
      return false;
    }

    try {
      // Show the install prompt
      state.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await state.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setState(prev => ({ ...prev, deferredPrompt: null }));
        return true;
      } else {
        console.log('User dismissed the install prompt');
        setState(prev => ({ ...prev, deferredPrompt: null }));
        return false;
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    }
  }, [state.deferredPrompt]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        return true;
      }
    }
    return false;
  }, []);

  // Clear all caches
  const clearCaches = useCallback(async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Initial checks
    checkInstallStatus();
    checkServiceWorker();

    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setState(prev => ({
        ...prev,
        deferredPrompt: e as BeforeInstallPromptEvent,
        canInstall: true
      }));
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setState(prev => ({
        ...prev,
        isInstalled: true,
        deferredPrompt: null,
        canInstall: false
      }));
    };

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => checkInstallStatus();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, [checkInstallStatus, checkServiceWorker]);

  return {
    ...state,
    installPWA,
    checkForUpdates,
    clearCaches,
    checkInstallStatus,
    checkServiceWorker
  };
} 