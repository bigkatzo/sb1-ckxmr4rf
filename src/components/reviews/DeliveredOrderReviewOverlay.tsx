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

  // Only prevent scroll for modal, not for overlay
  useEffect(() => {
    if (showReviewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showReviewModal]);

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
            <div className="bg-gray-900 rounded-lg shadow-2xl max-w-md w-full">
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
                    className="text-gray-400 hover:text-gray-300 transition-colors"
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
                    <div className="text-xs text-gray-400 mt-1 text-right">
                      {reviewText.length}/500 characters
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded">{error}</div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowReviewModal(false);
                        if (onClose) onClose();
                      }}
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={submitting || rating === 0}
                      className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
      {/* Compact overlay - only covers bottom portion, not full card */}
      <div className="absolute inset-x-0 bottom-0 h-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-lg flex items-end justify-center p-3 z-10">
        <div 
          className="max-w-sm w-full bg-gray-900/95 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {existingReview && !isEditing ? (
            // Compact existing review display
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">Thank you for your review!</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={existingReview.product_rating} size="sm" />
                    <span className="text-sm text-gray-300">
                      {existingReview.product_rating}/5 stars
                    </span>
                  </div>
                  {existingReview.review_text && (
                    <p className="text-sm text-gray-400 line-clamp-1 mt-1">
                      "{existingReview.review_text}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowOverlay(false);
                    if (forceShow && onDismiss) {
                      onDismiss();
                    }
                  }}
                  className="text-gray-400 hover:text-gray-300 p-1 ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleEditReview}
                  className="text-sm text-secondary hover:text-secondary-light transition-colors"
                >
                  Edit Review
                </button>
              </div>
            </div>
          ) : (
            // Compact review form
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-medium text-sm">
                    {existingReview && isEditing ? 'Edit Your Review' : 'Leave a Review!'}
                  </h4>
                  <p className="text-gray-300 text-xs">
                    {existingReview && isEditing 
                      ? 'Update your thoughts:'
                      : 'We hope you loved your products!'}
                  </p>
                </div>
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
                  className="text-gray-400 hover:text-gray-300 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rating */}
              <div>
                <StarRating
                  rating={rating}
                  onRatingChange={setRating}
                  interactive
                  size="sm"
                />
              </div>

              {/* Review Text - Dark mode styling */}
              <div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none text-sm"
                  rows={2}
                  placeholder="Share your thoughts..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {reviewText.length}/500
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded text-center">{error}</div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
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
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs"
                >
                  {existingReview && isEditing ? 'Cancel' : 'Skip'}
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting || rating === 0}
                  className="flex-1 px-3 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
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