import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePreventScroll } from '../../../hooks/usePreventScroll';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl'
};

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '',
  maxWidth = 'lg',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true
}: ModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hasMobileBuyButton, setHasMobileBuyButton] = useState(false);

  // Enhanced scroll prevention
  usePreventScroll(isOpen);

  // Detect mobile and mobile buy button
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // Check for mobile buy button
      if (mobile) {
        const buyButton = document.querySelector('.fixed.bottom-0, .safe-area-bottom');
        setHasMobileBuyButton(!!buyButton);
      } else {
        setHasMobileBuyButton(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isOpen]);

  // Keyboard event handling
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    // Focus the modal when it opens
    const modalElement = document.querySelector('[role="dialog"]') as HTMLElement;
    if (modalElement) {
      modalElement.focus();
    }

    // Trap focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalElement?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate dynamic heights based on mobile buy button presence
  const mobileBuyButtonHeight = hasMobileBuyButton ? 120 : 0;
  const basePadding = 32;
  const modalHeaderHeight = 80;
  
  const calculateMaxHeight = () => {
    if (isMobile) {
      return `calc(100vh - ${basePadding}px - ${mobileBuyButtonHeight}px)`;
    }
    return `calc(100vh - ${basePadding}px)`;
  };
  
  const calculateContentMaxHeight = () => {
    if (isMobile) {
      return `calc(100vh - ${basePadding}px - ${modalHeaderHeight}px - ${mobileBuyButtonHeight}px)`;
    }
    return `calc(100vh - ${basePadding}px - ${modalHeaderHeight}px)`;
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left), 16px)',
        paddingRight: 'max(env(safe-area-inset-right), 16px)',
        // Account for mobile buy button on small screens, safe area on larger screens
        paddingBottom: isMobile && hasMobileBuyButton ? `${mobileBuyButtonHeight}px` : 'max(env(safe-area-inset-bottom), 16px)'
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      tabIndex={-1}
    >
      {/* Enhanced backdrop with smooth transition and blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-all duration-300 ease-out"
        onClick={handleBackdropClick}
        aria-hidden="true"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      />
      
      {/* Modal container with bulletproof sizing */}
      <div 
        className={`
          relative w-full ${maxWidthClasses[maxWidth]} 
          bg-gray-900 rounded-xl border border-gray-700 
          shadow-2xl transform transition-all duration-300 
          modal-content animate-fade-in
          flex flex-col
          ${className}
        `}
        style={{
          maxHeight: calculateMaxHeight(),
          height: 'auto',
          minHeight: '200px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header - always visible and accessible */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 bg-gray-900 rounded-t-xl shrink-0">
          <h2 
            id="modal-title"
            className="text-lg sm:text-xl font-semibold text-white truncate pr-4"
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close modal"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>

        {/* Scrollable content with proper overflow containment */}
        <div 
          className="flex-1 overflow-hidden"
          style={{
            minHeight: '0' // Critical for flexbox overflow
          }}
        >
          <div 
            className="h-full overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            data-modal-scrollable
            data-allow-scroll="true"
            style={{
              maxHeight: calculateContentMaxHeight(),
              overflowY: 'auto',
              overscrollBehavior: 'contain'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}