import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import { StarRating } from './StarRating';

interface DeliveredOrderReviewOverlayProps {
  orderId: string;
  productId: string;
  productName: string;
  orderStatus: string;
}

export function DeliveredOrderReviewOverlay({ 
  orderId, 
  productId, 
  productName, 
  orderStatus 
}: DeliveredOrderReviewOverlayProps) {

  const [showOverlay, setShowOverlay] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [existingReview, setExistingReview] = useState<any>(null);

  useEffect(() => {
    if (orderStatus === 'DELIVERED' || orderStatus === 'delivered') {
      checkReviewStatus();
    }
  }, [orderId, productId, orderStatus]);

  const checkReviewStatus = async () => {
    try {
      setLoading(true);
      const [permission, existing] = await Promise.all([
        reviewService.canUserReview(orderId, productId),
        reviewService.getUserReview(productId, orderId)
      ]);
      
      setExistingReview(existing);
      
      // Show overlay if user can review OR if they have an existing review
      setShowOverlay(permission.canReview || existing !== null);
    } catch (error) {
      console.error('Failed to check review status:', error);
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
      
      if (existingReview) {
        await reviewService.updateReview(existingReview.id, {
          productRating: rating,
          reviewText: reviewText.trim() || null
        });
      } else {
        await reviewService.submitReview(productId, orderId, {
          productRating: rating,
          reviewText: reviewText.trim() || null
        });
      }
      
      setShowReviewModal(false);
      await checkReviewStatus(); // Refresh status
    } catch (error) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = () => {
    if (existingReview) {
      setRating(existingReview.product_rating);
      setReviewText(existingReview.review_text || '');
    }
    setShowReviewModal(true);
  };

  if (loading || !showOverlay || orderStatus !== 'DELIVERED') {
    return null;
  }

  return (
    <>
      {/* Transparent Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-lg flex items-end p-4 z-10">
        <div className="w-full bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {existingReview ? (
                <div className="space-y-2">
                  <p className="text-white font-medium text-sm">Thank you for your review!</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={existingReview.product_rating} size="sm" />
                    <span className="text-sm text-gray-300">
                      {existingReview.product_rating}/5 stars
                    </span>
                  </div>
                  {existingReview.review_text && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      "{existingReview.review_text}"
                    </p>
                  )}
                  <button
                    onClick={handleEditReview}
                    className="text-sm text-secondary hover:text-secondary-light transition-colors"
                  >
                    Edit Review
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-white font-medium text-sm">
                    We hope you loved your products!
                  </p>
                  <p className="text-gray-300 text-sm">
                    Let us know what you think:
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!existingReview && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary-dark transition-colors text-sm font-medium"
                >
                  Leave a Review
                </button>
              )}
              <button
                onClick={() => setShowOverlay(false)}
                className="text-gray-400 hover:text-gray-300 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {existingReview ? 'Edit Review' : 'Review'} {productName}
                </h3>
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
                    {submitting ? 'Submitting...' : (existingReview ? 'Update Review' : 'Submit Review')}
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