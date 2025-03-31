import React from 'react';
import { Modal } from './Modal';

interface ModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  title: string;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  submitButton?: React.ReactNode;
}

export function ModalForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  children, 
  submitLabel,
  className = '',
  isLoading,
  error,
  submitButton
}: ModalFormProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className={className}>
      <form onSubmit={onSubmit} className="flex flex-col h-full">
        <div className="flex-1 p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {children}
        </div>
        <div className="sticky bottom-0 bg-gray-900 flex justify-end gap-3 p-4 sm:p-6 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {submitButton || (
            <button
              type="submit"
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitLabel}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}