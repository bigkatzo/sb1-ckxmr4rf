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

  // Effect to handle forced visibility
  useEffect(() => {
    if (forceShow) {
      setShowOverlay(true);
    }
  }, [forceShow]);

  // Effect to handle initial load and status changes
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

  // Prevent body scroll when overlay or modal is open
  useEffect(() => {
    if ((showOverlay && !loading) || showReviewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showOverlay, showReviewModal, loading]);

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
        setRating(existing.product_rating);
        setReviewText(existing.review_text || '');
      }
      
      // For delivered orders, always show the overlay so users can leave or edit reviews
      const shouldShow = orderStatus.toLowerCase() === 'delivered';
      if (shouldShow) {
        setShowOverlay(true);
      }
      
      console.log('DeliveredOrderReviewOverlay: Should show overlay?', shouldShow, { 
        orderStatus: orderStatus.toLowerCase(), 
        canReview: permission.canReview, 
        hasExisting: existing !== null, 
        reason: permission.reason 
      });
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
      setRating(existingReview.product_rating);
      setReviewText(existingReview.review_text || '');
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    // Reset to original values
    if (existingReview) {
      setRating(existingReview.product_rating);
      setReviewText(existingReview.review_text || '');
    }
  };

  // If forceShowModal is true, only show the modal, not the overlay
  if (forceShowModal) {
    return (
      <>
        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-white tracking-tight">
                    {existingReview ? 'Edit Review' : 'Review'} {productName}
                  </h3>
                  <button
                    onClick={() => {
                      setShowReviewModal(false);
                      if (onClose) onClose();
                    }}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-3">
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
                    <label className="block text-sm font-medium text-gray-200 mb-3">
                      Review (Optional)
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none transition-all duration-200"
                      rows={4}
                      placeholder="Share your thoughts about this product..."
                      maxLength={500}
                    />
                    <div className="text-xs text-gray-400 mt-2 text-right">
                      {reviewText.length}/500 characters
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg">{error}</div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => {
                        setShowReviewModal(false);
                        if (onClose) onClose();
                      }}
                      className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={submitting || rating === 0}
                      className="flex-1 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg shadow-secondary/20"
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

  return (
    <>
      {/* Transparent Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-opacity duration-300" 
        onClick={() => {
          if (!isEditing) {
            setShowOverlay(false);
            if (forceShow && onDismiss) {
              onDismiss();
            }
          }
        }} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-xl flex items-end p-6 z-50">
        <div 
          className="w-full bg-gray-900/95 backdrop-blur-md rounded-xl p-6 border border-gray-700/50 shadow-2xl transform transition-all duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {existingReview && !isEditing ? (
            // Show existing review display - centered and properly formatted
            <div className="flex flex-col items-center space-y-6 max-w-md mx-auto">
              <div className="text-center">
                <h4 className="text-white font-semibold text-xl mb-2 tracking-tight">Your Review</h4>
                <p className="text-gray-300 text-sm">
                  Thank you for reviewing {productName}!
                </p>
              </div>

              {/* Rating Display */}
              <div className="flex flex-col items-center space-y-3">
                <StarRating rating={existingReview.product_rating} size="lg" />
                <span className="text-gray-300 text-sm font-medium">
                  {existingReview.product_rating}/5 stars
                </span>
              </div>

              {/* Review Text Display */}
              {existingReview.review_text && (
                <div className="w-full bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <p className="text-gray-200 text-sm leading-relaxed text-center italic">
                    "{existingReview.review_text}"
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-4 w-full max-w-xs">
                <button
                  onClick={() => {
                    setShowOverlay(false);
                    if (forceShow && onDismiss) {
                      onDismiss();
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleEditReview}
                  className="flex-1 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary-dark transition-colors text-sm font-medium shadow-lg shadow-secondary/20"
                >
                  Edit Review
                </button>
              </div>
            </div>
          ) : (
            // Show review form - either for new review or editing existing
            <div className="flex flex-col items-center space-y-6 max-w-sm mx-auto">
              <div className="text-center">
                <h4 className="text-white font-semibold text-xl mb-2 tracking-tight">
                  {existingReview && isEditing ? 'Edit Your Review' : 'Leave a Review!'}
                </h4>
                <p className="text-gray-300 text-sm">
                  {existingReview && isEditing 
                    ? 'Update your thoughts about this product:'
                    : 'We hope you loved your products. Let us know:'}
                </p>
              </div>

              {/* Rating */}
              <div className="flex flex-col items-center space-y-3">
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
                  className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none text-sm transition-all duration-200"
                  rows={3}
                  placeholder="Share your thoughts about this product..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 mt-2 text-right">
                  {reviewText.length}/500 characters
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-lg text-center">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-4 w-full max-w-xs">
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
                  className="flex-1 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  {existingReview && isEditing ? 'Cancel' : 'Skip'}
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting || rating === 0}
                  className="flex-1 px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg shadow-secondary/20"
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