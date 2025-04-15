import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from '../ui/PageTransition';
import Navbar from './Navbar';
import { Footer } from './Footer';
import { TransactionStatus } from '../ui/TransactionStatus';
import { WalletNotifications } from '../wallet/WalletNotifications';
import { useWallet } from '../../contexts/WalletContext';
import { usePayment } from '../../hooks/usePayment';
import { ToastContainer } from 'react-toastify';
import { ScrollBehavior } from '../ui/ScrollBehavior';
import { HowItWorksModal } from '../HowItWorksModal';
import { useAuth } from '../../contexts/AuthContext';
import { useHowItWorks } from '../../contexts/HowItWorksContext';
import { useEffect } from 'react';

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
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <WalletNotifications 
      notifications={notifications} 
      onDismiss={dismissNotification} 
    />
  );
}

export function AnimatedLayout() {
  const location = useLocation();
  const { isOpen } = useHowItWorks();
  
  // Add effect to handle body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to ensure scroll is restored when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col relative overflow-x-hidden">
      <ScrollBehavior />
      <Navbar />
      <main className="flex-1 pt-14">
        <NotificationsWrapper />
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
          <AnimatePresence
            mode="wait"
            initial={false}
          >
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
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
      <HowItWorksModal />
    </div>
  );
} 