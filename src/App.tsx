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
import 'react-toastify/dist/ReactToastify.css';
import { setupServiceWorker } from './lib/service-worker';

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
    setupRealtimeInvalidation(supabase);
    
    // Set up service worker
    setupServiceWorker().catch(err => {
      console.error('Failed to set up service worker:', err);
    });
    
    return () => {
      cleanupPreloader();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col relative overflow-x-hidden">
      <ScrollBehavior />
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          <Outlet />
        </div>
      </main>
      <Footer />
      <div className="fixed bottom-0 right-0 z-[9999] p-4 space-y-4 max-w-full">
        <TransactionStatusWrapper />
        <NotificationsWrapper />
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