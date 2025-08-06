import React, { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from './Spinner';

interface SimpleDialogProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  loading?: boolean;
}

export function SimpleDialog({ 
  open, 
  onClose, 
  children, 
  className = '',
  title,
  description,
  confirmLabel,
  onConfirm,
  loading
}: SimpleDialogProps) {
  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const dialogContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className={`bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${className}`}>
        {children || (
          <>
            {title && (
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                {title}
              </h3>
            )}
            
            {description && (
              <p className="text-sm text-gray-600 mb-6">
                {description}
              </p>
            )}

            {(confirmLabel || onConfirm) && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                {onConfirm && (
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <Spinner className="mx-auto h-4 w-4" />
                    ) : (
                      confirmLabel || 'Confirm'
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
} 