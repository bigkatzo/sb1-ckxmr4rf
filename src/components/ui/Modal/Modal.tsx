import React, { useEffect } from 'react';
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
  // Enhanced scroll prevention
  usePreventScroll(isOpen);

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

  return (
    <div 
      className={`fixed inset-0 z-[60] overflow-y-auto ${className}`}
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))'
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      tabIndex={-1}
    >
      {/* Enhanced backdrop with smooth transition and blur */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-all duration-300 ease-out z-[55]"
        onClick={handleBackdropClick}
        aria-hidden="true"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      />
      
      {/* Modal container with improved mobile handling */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8 z-[65]">
        <div 
          className={`
            relative w-full ${maxWidthClasses[maxWidth]} 
            bg-gray-900 rounded-xl border border-gray-700 
            shadow-2xl transform transition-all duration-300 
            modal-content animate-fade-in
            ${className}
          `}
          style={{
            maxHeight: 'calc(100vh - max(32px, env(safe-area-inset-top)) - max(32px, env(safe-area-inset-bottom)))',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - always visible and accessible */}
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

          {/* Scrollable content with enhanced mobile handling */}
          <div 
            className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            data-modal-scrollable
            style={{
              maxHeight: 'calc(100vh - max(120px, env(safe-area-inset-top) + env(safe-area-inset-bottom) + 120px))'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}