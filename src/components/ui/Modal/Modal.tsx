import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePreventScroll } from '../../../hooks/usePreventScroll';
import { useAppMessages } from '../../../contexts/AppMessagesContext';

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
  const { activeMarquee } = useAppMessages();

  // Enhanced scroll prevention
  usePreventScroll(isOpen);

  // Detect mobile for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Dynamic responsive calculations using viewport units and CSS custom properties
  const getResponsivePadding = () => {
    return isMobile ? 'max(4vw, 16px)' : 'max(2vw, 24px)';
  };
  
  const getNavbarHeight = () => {
    return isMobile ? 'max(14vw, 56px)' : 'max(8vh, 64px)';
  };
  
  const getMarqueeHeight = () => {
    return activeMarquee ? 'max(4vh, 32px)' : '0px';
  };
  
  const getModalHeaderHeight = () => {
    return isMobile ? 'max(10vh, 80px)' : 'max(8vh, 80px)';
  };

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center ${className.includes('z-[') ? className.match(/z-\[[^\]]+\]/)?.[0] || 'z-[70]' : 'z-[70]'}`}
      style={{
        paddingTop: `max(env(safe-area-inset-top), calc(${getResponsivePadding()} + ${getNavbarHeight()} + ${getMarqueeHeight()}))`,
        paddingLeft: `max(env(safe-area-inset-left), ${getResponsivePadding()})`,
        paddingRight: `max(env(safe-area-inset-right), ${getResponsivePadding()})`,
        paddingBottom: `max(env(safe-area-inset-bottom), ${getResponsivePadding()})`
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
          ${activeMarquee ? 'with-marquee' : ''}
          ${className.replace(/z-\[[^\]]+\]/g, '').trim()}
        `}
        style={{
          maxHeight: `calc(100vh - ${getResponsivePadding()} - ${getNavbarHeight()} - ${getMarqueeHeight()})`,
          height: 'auto',
          minHeight: isMobile ? 'max(40vh, 200px)' : 'max(30vh, 200px)',
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
            style={{
              maxHeight: `calc(100vh - ${getResponsivePadding()} - ${getNavbarHeight()} - ${getMarqueeHeight()} - ${getModalHeaderHeight()})`,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch' // Enable momentum scrolling on iOS
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}