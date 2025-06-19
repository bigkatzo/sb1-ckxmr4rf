import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import { StarRating } from './StarRating';
import type { ReviewPermissionCheck } from '../../types/reviews';

interface OrderReviewButtonProps {
  orderId: string;
  productId: string;
  productName: string;
  orderStatus: string;
  className?: string;
}

export function OrderReviewButton({ 
  orderId, 
  productId, 
  productName, 
  orderStatus,
  className = '' 
}: OrderReviewButtonProps) {
  const [permissionCheck, setPermissionCheck] = useState<ReviewPermissionCheck | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkReviewPermission();
  }, [orderId, productId]);

  const checkReviewPermission = async () => {
    try {
      setLoading(true);
      const permission = await reviewService.canUserReview(orderId, productId);
      setPermissionCheck(permission);
    } catch (error) {
      console.error('Failed to check review permission:', error);
      setPermissionCheck({ canReview: false, reason: 'Failed to check permissions' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await reviewService.submitReview(productId, orderId, {
        productRating: rating,
        reviewText: reviewText.trim() || null
      });
      
      setShowReviewModal(false);
      // Refresh permission check to show updated state
      await checkReviewPermission();
    } catch (error) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-800 h-8 rounded" />;
  }

  if (!permissionCheck?.canReview || orderStatus !== 'DELIVERED') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowReviewModal(true)}
        className={`bg-secondary/80 text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors ${className}`}
      >
        Leave a Review
      </button>

      {/* Simple Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Review {productName}</h3>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Rating
                  </label>
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    interactive
                    size="lg"
                  />
                </div>

                {/* Review Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Review (Optional)
                  </label>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="w-full h-24 px-3 py-2 text-gray-200 bg-gray-800 rounded-lg border border-gray-700 
                             focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
                    placeholder="Share your experience..."
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-sm">{error}</div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-white bg-secondary rounded-lg hover:bg-secondary-dark 
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 