import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { usePreventScroll } from '../../../hooks/usePreventScroll';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  usePreventScroll(isOpen);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50" 
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className={`relative w-full sm:w-auto bg-gray-900 sm:rounded-xl shadow-xl overflow-hidden ${className}`}>
            <div className="sticky top-0 bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white p-2 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto scroll-smooth scrollbar-hide">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}