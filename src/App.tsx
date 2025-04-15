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
    // Set up cache preloader
    const cleanupPreloader = setupCachePreloader();
    
    // Set up realtime cache invalidation
    const cleanup = setupRealtimeInvalidation(supabase);
    
    // Set up service worker
    setupServiceWorker().catch(err => {
      console.error('Failed to set up service worker:', err);
    });

    // Expose realtime debugging utilities in development
    if (import.meta.env.DEV) {
      exposeRealtimeDebugger();
    }
    
    // Set up realtime health
    setupRealtimeHealth();
    
    return () => {
      cleanupPreloader();
      cleanup();
    };
  }, []);

  return <Outlet />; // Render the Outlet to show nested routes
}

export function App() {
  // Initialize realtime debugger when app mounts
  useEffect(() => {
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