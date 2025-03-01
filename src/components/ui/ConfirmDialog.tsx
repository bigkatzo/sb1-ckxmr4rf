import React from 'react';
import { Dialog } from '@headlessui/react';
import { Spinner } from './Spinner';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="relative w-full max-w-sm rounded-xl bg-gray-900 p-6">
        <Dialog.Title className="text-lg font-semibold mb-2 text-white">
          {title}
        </Dialog.Title>
        
        <Dialog.Description className="text-sm text-gray-300 mb-6">
          {description}
        </Dialog.Description>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Spinner className="mx-auto h-4 w-4" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}