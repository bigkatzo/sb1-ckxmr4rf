import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CollectionProvider } from './contexts/CollectionContext';
import { WalletProvider } from './contexts/WalletContext';
import { ModalProvider } from './contexts/ModalContext';
import { HowItWorksProvider } from './contexts/HowItWorksContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { validateEnvironmentVariables } from './utils/env-validation';
import { setupCachePreloader } from './lib/cache-preloader';
import { setupRealtimeInvalidation } from './lib/cache';
import { supabase } from './lib/supabase';
import 'react-toastify/dist/ReactToastify.css';
import { setupServiceWorker } from './lib/service-worker';
import { exposeRealtimeDebugger } from './utils/realtime-diagnostics';
import { setupRealtimeHealth } from './lib/realtime/subscriptions';

// Validate environment variables at startup
validateEnvironmentVariables();

function AppContent() {
  // Initialize cache system
  useEffect(() => {
    // Set up cache preloader with high priority for LCP images
    const cleanupPreloader = setupCachePreloader({
      maxConcurrent: 2,
      timeout: 5000,
      categories: ['lcp', 'featured']
    });
    
    // Set up realtime cache invalidation with delay
    let cleanup = () => {};
    const invalidationTimer = setTimeout(() => {
      cleanup = setupRealtimeInvalidation(supabase);
    }, 2000);
    
    // Set up service worker - defer this to not block main thread
    const serviceWorkerTimer = setTimeout(() => {
      setupServiceWorker().catch(err => {
        console.error('Failed to set up service worker:', err);
      });
    }, 5000);
    
    // Expose realtime debugging utilities in development with more delay
    let realtimeTimer: ReturnType<typeof setTimeout>;
    if (import.meta.env.DEV) {
      realtimeTimer = setTimeout(() => {
        exposeRealtimeDebugger();
      }, 4000);
    }
    
    // Set up realtime health with longer delay to avoid blocking LCP
    const realtimeHealthTimer = setTimeout(() => {
      setupRealtimeHealth();
    }, 3000);
    
    return () => {
      cleanupPreloader();
      cleanup();
      clearTimeout(serviceWorkerTimer);
      clearTimeout(realtimeHealthTimer);
      clearTimeout(invalidationTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
    };
  }, []);

  return <Outlet />; // Render the Outlet to show nested routes
}

export function App() {
  // Initialize realtime debugger when app mounts
  useEffect(() => {
    // Delay non-critical operations to prioritize LCP
    const timer = setTimeout(() => {
      // Force immediate connection to Supabase realtime
      try {
        const realtimeClient = (supabase.realtime as any);
        if (realtimeClient && typeof realtimeClient.connect === 'function') {
          console.log('Forcing initial Supabase realtime connection...');
          realtimeClient.connect();
        }
      } catch (err) {
        console.error('Error establishing initial Supabase connection:', err);
      }
      
      exposeRealtimeDebugger();
      console.log('Supabase realtime debugger initialized. Try window.debugRealtime() in the console.');
    }, 4000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WalletProvider>
          <CollectionProvider>
            <ModalProvider>
              <HowItWorksProvider>
                <AppContent />
              </HowItWorksProvider>
            </ModalProvider>
          </CollectionProvider>
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;