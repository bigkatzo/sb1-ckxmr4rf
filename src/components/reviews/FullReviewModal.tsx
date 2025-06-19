import React from 'react';
import { Modal } from '../ui/Modal/Modal';
import { ReviewStats } from './ReviewStats';
import { ReviewSection } from './ReviewSection';
import type { ReviewStats as ReviewStatsType } from '../../types/reviews';

interface FullReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  orderId?: string;
  stats: ReviewStatsType;
}

export function FullReviewModal({
  isOpen,
  onClose,
  productId,
  orderId,
  stats
}: FullReviewModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Product Reviews">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-auto">
        <div className="p-6 space-y-6">
          {/* Review Statistics */}
          <ReviewStats stats={stats} />

          {/* Full Review List */}
          <ReviewSection 
            productId={productId}
            orderId={orderId}
          />
        </div>
      </div>
    </Modal>
  );
} 