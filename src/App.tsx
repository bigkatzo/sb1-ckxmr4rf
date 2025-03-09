import { Outlet, ScrollRestoration } from 'react-router-dom';
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
import 'react-toastify/dist/ReactToastify.css';

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
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col relative overflow-x-hidden">
      <ScrollRestoration />
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          <Outlet />
        </div>
      </main>
      <Footer />
      <div className="fixed bottom-0 right-0 z-40 p-4 space-y-4 max-w-full">
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
        className="z-[9999] max-w-[90vw] sm:max-w-md"
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