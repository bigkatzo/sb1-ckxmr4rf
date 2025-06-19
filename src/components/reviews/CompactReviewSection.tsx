import React, { useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { StarRating } from './StarRating';
import { FullReviewModal } from './FullReviewModal';
import type { ReviewStats } from '../../types/reviews';

interface CompactReviewSectionProps {
  productId: string;
  orderId?: string;
  stats: ReviewStats;
  className?: string;
}

export function CompactReviewSection({ productId, orderId, stats, className = '' }: CompactReviewSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!stats || stats.totalReviews === 0) {
    return (
      <div className={`text-gray-400 text-sm ${className}`}>
        No reviews yet
      </div>
    );
  }

  return (
    <>
      {/* Compact Preview */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`w-full text-left hover:bg-gray-800/50 rounded-lg p-4 transition-colors ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StarRating rating={stats.averageRating} size="sm" />
              <span className="text-gray-300">
                {stats.averageRating.toFixed(1)} ({stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            
            {/* Recent Reviews Preview */}
            {stats.recentReviews && stats.recentReviews.length > 0 && (
              <div className="space-y-2">
                {stats.recentReviews.slice(0, 3).map((review, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    {review.text && (
                      <p className="text-sm text-gray-400 line-clamp-1">
                        {review.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </button>

      {/* Full Review Modal */}
      <FullReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
        orderId={orderId}
        stats={stats}
      />
    </>
  );
} 