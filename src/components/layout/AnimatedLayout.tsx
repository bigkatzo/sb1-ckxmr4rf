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
import { useEffect, useState } from 'react';
import { AppMessagesRenderer } from '../../contexts/AppMessagesContext';
import { useAppMessages } from '../../contexts/AppMessagesContext';
import { initializeImageHandling, fixAllImages } from '../../utils/imageValidator';

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
  const [prevPathname, setPrevPathname] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const { activeMarquee } = useAppMessages();
  
  // Initialize global image error handling
  useEffect(() => {
    initializeImageHandling();
    
    // Apply emergency fix for broken images
    fixAllImages();
    
    // Re-apply fix on route changes
    return () => {
      // Wait for new content to render
      setTimeout(() => {
        fixAllImages();
      }, 300);
    };
  }, [location.pathname]);
  
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
  
  // Detect navigation changes
  useEffect(() => {
    if (prevPathname && prevPathname !== location.pathname) {
      setIsNavigating(true);
      
      // Reset navigating state after transition
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 300); // Slightly longer than animation duration
      
      return () => clearTimeout(timer);
    }
    
    setPrevPathname(location.pathname);
  }, [location.pathname, prevPathname]);
  
  // Calculate container height for less layout shift
  // This helps minimize CLS (Cumulative Layout Shift)
  const getContainerMinHeight = () => {
    // Use a min height based on viewport to avoid jumps
    return 'min-h-[80vh]';
  };

  return (
    <div className={`min-h-screen bg-gray-950 text-white flex flex-col relative overflow-x-hidden will-change-transform ${isNavigating ? 'pointer-events-none' : ''}`}>
      <AppMessagesRenderer />
      
      <ScrollBehavior />
      
      <Navbar />
      
      <main className={`flex-1 ${activeMarquee ? 'pt-20' : 'pt-12'} overflow-x-hidden`}>
        <NotificationsWrapper />
        <div className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 w-full ${getContainerMinHeight()}`}>
          <AnimatePresence
            mode="wait"
            initial={false}
            // Prevent re-renders during transitions for better performance
            onExitComplete={() => window.scrollTo(0, 0)}
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