import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { CollectionProvider } from './contexts/CollectionContext';
import { WalletProvider } from './contexts/WalletContext';
import { ModalProvider } from './contexts/ModalContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import Navbar from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { TransactionStatus } from './components/ui/TransactionStatus';
import { WalletNotifications } from './components/wallet/WalletNotifications';
import { useWallet } from './contexts/WalletContext';
import { usePayment } from './hooks/usePayment';
import { ToastContainer } from 'react-toastify';
import { validateEnvironmentVariables } from './utils/env-validation';
import { ScrollBehavior } from './components/ui/ScrollBehavior';
import { setupCachePreloader } from './lib/cache-preloader';
import { setupRealtimeInvalidation } from './lib/cache';
import { supabase } from './lib/supabase';
import { preloadNFTVerifier } from './utils/nft-verification';
import 'react-toastify/dist/ReactToastify.css';
import { setupServiceWorker } from './lib/service-worker';
import { exposeRealtimeDebugger } from './utils/realtime-diagnostics';
import { setupRealtimeHealth } from './lib/realtime/subscriptions';

// Validate environment variables at startup
validateEnvironmentVariables();

function TransactionStatusWrapper() {
  const { status, resetStatus } = usePayment();
  
  if (!status.processing && !status.success && !status.error) {
    return null;
  }

  return (
    <TransactionStatus
      processing={status.processing}
      success={status.success}
      error={status.error}
      signature={status.signature}
      onClose={resetStatus}
    />
  );
}

function NotificationsWrapper() {
  const { notifications, dismissNotification } = useWallet();
  return (
    <WalletNotifications 
      notifications={notifications} 
      onDismiss={dismissNotification} 
    />
  );
}

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

    // Preload NFT verifier after a delay
    preloadNFTVerifier();
    
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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col relative overflow-x-hidden">
      <ScrollBehavior />
      <Navbar />
      <NotificationsWrapper />
      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          <Outlet />
        </div>
      </main>
      <Footer />
      <div className="fixed bottom-0 right-0 z-[9999] p-4 space-y-4 max-w-full">
        <TransactionStatusWrapper />
      </div>
      <ToastContainer
        position="bottom-right"
        theme="dark"
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="z-[99999] max-w-[90vw] sm:max-w-md"
        style={{ zIndex: 99999 }}
      />
    </div>
  );
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
      <WalletProvider>
        <AuthProvider>
          <CollectionProvider>
            <ModalProvider>
              <AppContent />
            </ModalProvider>
          </CollectionProvider>
        </AuthProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
}

export default App;