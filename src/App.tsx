import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CollectionProvider } from './contexts/CollectionContext';
import { WalletProvider } from './contexts/WalletContext';
import { ModalProvider } from './contexts/ModalContext';
import { HowItWorksProvider } from './contexts/HowItWorksContext';
import { AppMessagesProvider } from './contexts/AppMessagesContext';
import { UserRoleProvider } from './contexts/UserRoleContext';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/cart/CartDrawer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PageTransition } from './components/ui/PageTransition';
import { validateEnvironmentVariables } from './utils/env-validation';
import { setupCachePreloader } from './lib/cache-preloader';
import { setupRealtimeInvalidation } from './lib/cache';
import { supabase } from './lib/supabase';
import 'react-toastify/dist/ReactToastify.css';
import '../public/css/theme-variables.css';
import { setupServiceWorker } from './lib/service-worker';
import { exposeRealtimeDebugger } from './utils/realtime-diagnostics';
import { setupRealtimeHealth } from './lib/realtime/subscriptions';
import { useSyncWalletClaims } from './hooks/useSyncWalletClaims';

// Validate environment variables at startup
validateEnvironmentVariables();

function AppContent() {
  const { session } = useAuth();
  
  // Use our new hook to sync wallet address with JWT claims
  useSyncWalletClaims();
  
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
      // Get userId from session if available
      const userId = session?.user?.id;
      
      // Get shopId from user's metadata if available
      const shopId = session?.user?.user_metadata?.shop_id;
      
      // Set up more targeted realtime subscriptions
      cleanup = setupRealtimeInvalidation(supabase, {
        userId,
        shopId,
        // Only subscribe to tables relevant to the current user's context
        tables: userId ? [
          'products',
          'orders',
          'users',
          'shops',
          'inventory',
          'app_messages',
          ...(userId ? ['user_preferences'] : []),
          ...(shopId ? ['shop_settings'] : [])
        ] : ['products', 'shops', 'app_messages'] // Limited scope for anonymous users
      });
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
  }, [session]); // Add session as dependency

  // Wrap the Outlet with PageTransition for smooth navigation
  return (
    <PageTransition>
      <Outlet />
      <CartDrawer />
    </PageTransition>
  );
}

export function App() {
  // Initialize realtime debugger when app mounts
  useEffect(() => {
    // Apply theme colors from CSS variables to ensure overrides work
    const applyThemeColors = () => {
      try {
        const style = document.createElement('style');
        style.id = 'theme-override-styles';
        style.innerHTML = `
          /* Force purple overrides with theme variables */
          .bg-purple-600, .hover\\:bg-purple-600:hover { background-color: var(--color-primary) !important; }
          .bg-purple-700, .hover\\:bg-purple-700:hover { background-color: var(--color-primary-hover) !important; }
          .text-purple-400, .hover\\:text-purple-400:hover { color: var(--color-primary) !important; }
          .text-purple-300, .hover\\:text-purple-300:hover { color: var(--color-primary-light) !important; }
        `;
        document.head.appendChild(style);
        console.log('Theme override styles applied');
      } catch (err) {
        console.error('Error applying theme overrides:', err);
      }
    };
    
    // Apply theme immediately
    applyThemeColors();
    
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
        <UserRoleProvider>
          <WalletProvider>
            <CollectionProvider>
              <ModalProvider>
                <HowItWorksProvider>
                  <AppMessagesProvider>
                    <CartProvider>
                      <AppContent />
                    </CartProvider>
                  </AppMessagesProvider>
                </HowItWorksProvider>
              </ModalProvider>
            </CollectionProvider>
          </WalletProvider>
        </UserRoleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;