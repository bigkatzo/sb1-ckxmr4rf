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
}

export function ModalForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  children, 
  submitLabel,
  className = ''
}: ModalFormProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className={className}>
      <form onSubmit={onSubmit} className="flex flex-col h-full">
        <div className="flex-1 p-4 sm:p-6 space-y-6">
          {children}
        </div>
        <div className="sticky bottom-0 bg-gray-900 flex justify-end gap-3 p-4 sm:p-6 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}