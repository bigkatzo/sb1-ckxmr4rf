import React from 'react';
import { Modal } from '../ui/Modal/Modal';
import { ReviewForm } from './ReviewForm';
import type { ReviewFormData } from '../../types/reviews';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  productName: string;
  isLoading?: boolean;
}

export function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  productName,
  isLoading = false
}: ReviewModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review ${productName}`}>
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-auto">
        <div className="p-6">
          <ReviewForm
            productName={productName}
            onSubmit={onSubmit}
            onCancel={onClose}
            isLoading={isLoading}
          />
        </div>
      </div>
    </Modal>
  );
} 