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
  onReviewSubmitted?: (orderId: string, productId: string, review: any) => void;
}

export function DeliveredOrderReviewOverlay({ 
  orderId, 
  productId, 
  productName, 
  orderStatus,
  forceShowModal = false,
  onClose,
  forceShow = false,
  onDismiss,
  onReviewSubmitted
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
      
      let updatedReview;
      if (existingReview) {
        updatedReview = await reviewService.updateReview(existingReview.id, {
          productRating: rating,
          reviewText: reviewText.trim() || null
        });
      } else {
        updatedReview = await reviewService.submitReview(productId, orderId, {
          productRating: rating,
          reviewText: reviewText.trim() || null
        }, walletAddress || undefined, walletAuthToken || undefined);
      }
      
      // Update local state immediately with the new review
      setExistingReview(updatedReview);
      setIsEditing(false);
      setShowReviewModal(false);
      if (onClose) onClose();
      
      // Reset form state since we now have an existing review
      setRating(updatedReview.product_rating);
      setReviewText(updatedReview.review_text || '');
      
      // Notify parent component about the review update
      if (onReviewSubmitted && updatedReview) {
        onReviewSubmitted(orderId, productId, updatedReview);
      }
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
      {/* Compact modern overlay - only covers bottom portion with better design */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent rounded-lg flex items-end justify-center p-4 z-10">
        <div 
          className="max-w-md w-full bg-gray-900/95 backdrop-blur-md rounded-xl p-4 border border-gray-700/30 shadow-2xl transition-all duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {existingReview && !isEditing ? (
            // Modern existing review display with status badge
            <div className="space-y-3">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full text-sm font-medium mb-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Review Submitted
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <StarRating rating={existingReview.product_rating} size="md" />
                  <span className="text-sm text-gray-300 font-medium">
                    {existingReview.product_rating}/5 stars
                  </span>
                </div>
                {existingReview.review_text && (
                  <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 max-h-16 overflow-hidden">
                    <p className="text-sm text-gray-200 leading-relaxed italic line-clamp-2">
                      "{existingReview.review_text}"
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  onClick={handleEditReview}
                  className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary-light transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Review
                </button>
                <div className="h-4 w-px bg-gray-600"></div>
                <button
                  onClick={() => {
                    setShowOverlay(false);
                    if (forceShow && onDismiss) {
                      onDismiss();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          ) : (
            // Modern compact review form
            <div className="space-y-3 relative">
              {/* Header with badge */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-3 py-1.5 rounded-full text-sm font-medium mb-2">
                  {existingReview && isEditing ? 'Edit Your Review' : 'Leave a Review'}
                </div>
                <p className="text-gray-300 text-sm">
                  {existingReview && isEditing 
                    ? 'Update your thoughts'
                    : 'We hope you loved your products! Let us know:'}
                </p>
              </div>

              {/* Close button */}
              <div className="absolute top-0 right-0">
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
                  className="text-gray-400 hover:text-gray-300 p-1.5 hover:bg-gray-800/50 rounded-lg transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rating with background */}
              <div className="flex justify-center">
                <div className="bg-gray-800/30 rounded-lg p-2.5">
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    interactive
                    size="lg"
                  />
                </div>
              </div>

              {/* Review Text - Enhanced styling */}
              <div>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary/50 transition-all duration-200 resize-none text-sm leading-relaxed"
                  rows={2}
                  placeholder="Share your thoughts about this product"
                  maxLength={500}
                />
                <div className="flex justify-end mt-1">
                  <div className="text-xs text-gray-400">
                    {reviewText.length}/500
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-center flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Enhanced action buttons */}
              <div className="flex gap-2.5 pt-1">
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
                  className="flex-1 px-3 py-2 bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 text-sm font-medium border border-gray-600/30"
                >
                  {existingReview && isEditing ? 'Cancel' : 'Skip'}
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting || rating === 0}
                  className="flex-1 px-3 py-2 bg-secondary hover:bg-secondary-dark text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg shadow-secondary/20 border border-secondary/30"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    existingReview && isEditing ? 'Update' : 'Submit'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 