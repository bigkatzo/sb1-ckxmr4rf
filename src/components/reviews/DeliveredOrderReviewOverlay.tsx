import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import { StarRating } from './StarRating';
import { useWallet } from '../../contexts/WalletContext';

interface DeliveredOrderReviewOverlayProps {
  orderId: string;
  productId: string;
  productName: string;
  orderStatus: string;
  forceShowModal?: boolean;
  onClose?: () => void;
  forceShow?: boolean;
  onDismiss?: () => void;
}

export function DeliveredOrderReviewOverlay({ 
  orderId, 
  productId, 
  productName, 
  orderStatus,
  forceShowModal = false,
  onClose,
  forceShow = false,
  onDismiss
}: DeliveredOrderReviewOverlayProps) {

  const { walletAddress, walletAuthToken } = useWallet();
  const [showOverlay, setShowOverlay] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);


  useEffect(() => {
    const status = orderStatus.toLowerCase();
    if (status === 'delivered') {
      checkReviewStatus();
    }
  }, [orderId, productId, orderStatus]);

  // Handle forced modal display
  useEffect(() => {
    if (forceShowModal) {
      checkReviewStatus().then(() => {
        setShowReviewModal(true);
      });
    }
  }, [forceShowModal]);

  const checkReviewStatus = async () => {
    try {
      setLoading(true);
      console.log('DeliveredOrderReviewOverlay: Checking review status for', { orderId, productId, orderStatus });
      
      const [permission, existing] = await Promise.all([
        reviewService.canUserReview(orderId, productId, walletAddress || undefined, walletAuthToken || undefined),
        reviewService.getUserReview(productId, orderId)
      ]);
      
      console.log('DeliveredOrderReviewOverlay: Review status result', { permission, existing });
      
      setExistingReview(existing);
      
      // Initialize form with existing review data if editing
      if (existing) {
        setRating(existing.productRating);
        setReviewText(existing.reviewText || '');
      }
      
      // For delivered orders, always show the overlay so users can leave or edit reviews
      // The database function returns canReview: false when a review exists, but we still want to show
      // the overlay so users can edit their existing review
      const shouldShow = orderStatus.toLowerCase() === 'delivered';
      console.log('DeliveredOrderReviewOverlay: Should show overlay?', shouldShow, { 
        orderStatus: orderStatus.toLowerCase(), 
        canReview: permission.canReview, 
        hasExisting: existing !== null, 
        reason: permission.reason 
      });
      setShowOverlay(shouldShow);
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
        }, walletAddress || undefined, walletAuthToken || undefined);
      }
      
      setIsEditing(false);
      setShowReviewModal(false);
      if (onClose) onClose();
      await checkReviewStatus(); // Refresh status
    } catch (error) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = () => {
    if (existingReview) {
      setRating(existingReview.productRating);
      setReviewText(existingReview.reviewText || '');
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    // Reset to original values
    if (existingReview) {
      setRating(existingReview.productRating);
      setReviewText(existingReview.reviewText || '');
    }
  };

  // If forceShowModal is true, only show the modal, not the overlay
  if (forceShowModal) {
    return (
      <>
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
                    onClick={() => {
                      setShowReviewModal(false);
                      if (onClose) onClose();
                    }}
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
                      rows={4}
                      placeholder="Share your thoughts about this product..."
                      maxLength={500}
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      {reviewText.length}/500 characters
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-400 text-sm">{error}</div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowReviewModal(false);
                        if (onClose) onClose();
                      }}
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={submitting || rating === 0}
                      className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  if (loading || (!showOverlay && !forceShow) || orderStatus.toLowerCase() !== 'delivered') {
    return null;
  }

  console.log('DeliveredOrderReviewOverlay: Rendering overlay!', { orderId, productId, orderStatus, existingReview });

  return (
    <>
      {/* Transparent Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-lg flex items-end p-4 z-10">
        <div className="w-full bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
          {existingReview && !isEditing ? (
            // Show existing review display - centered and properly formatted
            <div className="flex flex-col items-center space-y-4 max-w-md mx-auto">
              <div className="text-center">
                <h4 className="text-white font-medium text-lg mb-1">Your Review</h4>
                <p className="text-gray-300 text-sm">
                  Thank you for reviewing {productName}!
                </p>
              </div>

              {/* Rating Display */}
              <div className="flex flex-col items-center space-y-2">
                <StarRating rating={existingReview.productRating} size="lg" />
                <span className="text-gray-300 text-sm font-medium">
                  {existingReview.productRating}/5 stars
                </span>
              </div>

              {/* Review Text Display */}
              {existingReview.reviewText && (
                <div className="w-full bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <p className="text-gray-200 text-sm leading-relaxed text-center">
                    "{existingReview.reviewText}"
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    setShowOverlay(false);
                    if (forceShow && onDismiss) {
                      onDismiss();
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Close
                </button>
                <button
                  onClick={handleEditReview}
                  className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors text-sm font-medium"
                >
                  Edit Review
                </button>
              </div>
            </div>
          ) : (
            // Show review form - either for new review or editing existing
            <div className="flex flex-col items-center space-y-4 max-w-sm mx-auto">
              <div className="text-center">
                <h4 className="text-white font-medium text-lg mb-1">
                  {existingReview && isEditing ? 'Edit Your Review' : 'Leave a Review!'}
                </h4>
                <p className="text-gray-300 text-sm">
                  {existingReview && isEditing 
                    ? 'Update your thoughts about this product:'
                    : 'We hope you loved your products. Let us know:'
                  }
                </p>
              </div>

              {/* Rating */}
              <div className="flex flex-col items-center space-y-2">
                <StarRating
                  rating={rating}
                  onRatingChange={setRating}
                  interactive
                  size="lg"
                />
              </div>

              {/* Review Text */}
              <div className="w-full">
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none text-sm"
                  rows={3}
                  placeholder="Share your thoughts about this product..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {reviewText.length}/500 characters
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    if (existingReview && isEditing) {
                      handleCancelEdit();
                    } else {
                      setShowOverlay(false);
                      if (forceShow && onDismiss) {
                        onDismiss();
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  {existingReview && isEditing ? 'Cancel' : 'Skip'}
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting || rating === 0}
                  className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {submitting ? 'Submitting...' : (existingReview && isEditing ? 'Update' : 'Submit')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 