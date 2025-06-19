import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { ReviewStats } from './ReviewStats';
import { StarRating } from './StarRating';
import { Shield, Clock } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import type { ReviewStats as ReviewStatsType, FormattedReview } from '../../types/reviews';

interface FullReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  stats: ReviewStatsType;
}

export function FullReviewModal({
  isOpen,
  onClose,
  productId,
  stats
}: FullReviewModalProps) {
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadReviews();
    }
  }, [isOpen, productId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const data = await reviewService.getProductReviews(productId);
      setReviews(data.reviews);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Product Reviews">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-auto">
        <div className="p-6 space-y-6">
          {/* Review Statistics */}
          <ReviewStats stats={stats} />

          {/* Full Review List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">All Reviews</h3>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-800 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.productRating} size="md" />
                        {review.isVerifiedPurchase && (
                          <div className="flex items-center gap-1 text-green-400 text-xs">
                            <Shield className="h-3 w-3" />
                            <span>Verified Purchase</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {review.reviewText && (
                      <p className="text-gray-300 mb-3 leading-relaxed">
                        {review.reviewText}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono">
                          {review.formattedWallet}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No reviews yet
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
} 