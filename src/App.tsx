import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CollectionProvider } from './contexts/CollectionContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { WalletProvider } from './contexts/WalletContext';
import { ModalProvider } from './contexts/ModalContext';
import { HowItWorksProvider } from './contexts/HowItWorksContext';
import { AppMessagesProvider } from './contexts/AppMessagesContext';
import { UserRoleProvider } from './contexts/UserRoleContext';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/cart/CartDrawer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PageTransition } from './components/ui/PageTransition';
import { PreviewBanner } from './components/ui/PreviewBanner';
import { PWAInstallPrompt } from './components/ui/PWAInstallPrompt';
import { PWAStatus } from './components/ui/PWAStatus';
import { validateEnvironmentVariables } from './utils/env-validation';
import { setupCachePreloader } from './lib/cache-preloader';
import { setupRealtimeInvalidation } from './lib/cache';
import { supabase } from './lib/supabase';
import 'react-toastify/dist/ReactToastify.css';
import { setupServiceWorker } from './lib/service-worker';
import { exposeRealtimeDebugger } from './utils/realtime-diagnostics';
import { setupRealtimeHealth } from './lib/realtime/subscriptions';
import { useSyncWalletClaims } from './hooks/useSyncWalletClaims';
import { PRIVY_CONFIG } from './config/privy';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

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
      try {
        setupRealtimeHealth();
      } catch (err) {
        console.error('Failed to set up realtime health monitoring:', err);
      }
    }, 6000);
    
    return () => {
      clearTimeout(invalidationTimer);
      clearTimeout(serviceWorkerTimer);
      clearTimeout(realtimeHealthTimer);
      if (realtimeTimer) clearTimeout(realtimeTimer);
      cleanupPreloader();
      cleanup();
    };
  }, [session]);

  // Wrap the Outlet with PageTransition for smooth navigation
  return (
    <>
      <PreviewBanner />
      <PageTransition>
        <Outlet />
        <CartDrawer />
        <PWAInstallPrompt />
        {import.meta.env.DEV && <PWAStatus />}
      </PageTransition>
    </>
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
          /* Comprehensive purple overrides with theme variables */
          html body .bg-purple-300, html body .hover\\:bg-purple-300:hover { background-color: var(--color-primary-light) !important; }
          html body .bg-purple-400, html body .hover\\:bg-purple-400:hover { background-color: var(--color-primary) !important; }
          html body .bg-purple-500, html body .hover\\:bg-purple-500:hover { background-color: var(--color-primary) !important; }
          html body .bg-purple-600, html body .hover\\:bg-purple-600:hover { background-color: var(--color-primary) !important; }
          html body .bg-purple-700, html body .hover\\:bg-purple-700:hover { background-color: var(--color-primary-hover) !important; }
          html body .bg-purple-900\\/20, html body .bg-purple-900\\/30, html body .bg-purple-900\\/50 { background-color: rgba(var(--color-primary-rgb), 0.2) !important; }
          
          html body .text-purple-200, html body .hover\\:text-purple-200:hover { color: var(--color-primary-light) !important; }
          html body .text-purple-300, html body .hover\\:text-purple-300:hover { color: var(--color-primary-light) !important; }
          html body .text-purple-400, html body .hover\\:text-purple-400:hover { color: var(--color-primary) !important; }
          html body .text-purple-500, html body .hover\\:text-purple-500:hover { color: var(--color-primary) !important; }
          
          html body .bg-purple-500\\/10 { background-color: rgba(var(--color-primary-rgb), 0.1) !important; }
          html body .bg-purple-500\\/20 { background-color: rgba(var(--color-primary-rgb), 0.2) !important; }
          html body .bg-purple-600\\/20 { background-color: rgba(var(--color-primary-rgb), 0.2) !important; }
          html body .bg-purple-700\\/60 { background-color: rgba(var(--color-primary-rgb), 0.6) !important; }
          
          html body .border-purple-500\\/20 { border-color: rgba(var(--color-primary-rgb), 0.2) !important; }
          html body .border-purple-500, html body .border-b-2.border-purple-500 { border-color: var(--color-primary) !important; }
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
      <QueryClientProvider client={queryClient}>
      {PRIVY_CONFIG.appId ? (
        <PrivyProvider 
          appId={PRIVY_CONFIG.appId}
          config={PRIVY_CONFIG.config}
          privyWalletOverride={PRIVY_CONFIG.privyWalletOverride}
          onError={(error: any) => {
            console.error('Privy error:', error);
          }}
        >
          <AuthProvider>
            <UserRoleProvider>
              <WalletProvider>
                <CollectionProvider>
                  <ThemeProvider>
                    <CurrencyProvider>
                      <ModalProvider>
                        <HowItWorksProvider>
                          <AppMessagesProvider>
                            <CartProvider>
                              <AppContent />
                            </CartProvider>
                          </AppMessagesProvider>
                        </HowItWorksProvider>
                      </ModalProvider>
                    </CurrencyProvider>
                  </ThemeProvider>
                </CollectionProvider>
              </WalletProvider>
            </UserRoleProvider>
          </AuthProvider>
        </PrivyProvider>
      ) : (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
            <p className="text-gray-400 mb-4">
              VITE_PRIVY_APP_ID environment variable is not set.
            </p>
            <p className="text-sm text-gray-500">
              Please check your environment configuration and restart the development server.
            </p>
          </div>
        </div>
      )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;