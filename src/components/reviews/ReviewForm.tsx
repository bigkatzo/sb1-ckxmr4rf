import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { MerchantFeedback } from '../ui/MerchantFeedback';

interface ReviewFormProps {
  onSubmit: (data: { productRating: number; reviewText?: string | null }) => Promise<void>;
  initialData?: {
    productRating?: number;
    reviewText?: string;
  };
  merchantId: string;
}

export function ReviewForm({ onSubmit, initialData, merchantId }: ReviewFormProps) {
  const [productRating, setProductRating] = useState(initialData?.productRating || 0);
  const [reviewText, setReviewText] = useState(initialData?.reviewText || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (productRating === 0) {
      setError('Please select a rating');
      return;
    }

    const trimmedReview = reviewText.trim();
    if (trimmedReview.length > 0 && trimmedReview.length < 10) {
      setError('If adding a review text, it must be at least 10 characters long');
      return;
    }

    if (trimmedReview.length > 1000) {
      setError('Review text must not exceed 1000 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        productRating,
        reviewText: trimmedReview || null
      });
    } catch (err) {
      setError('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Rating */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">
          Rate this Product
        </label>
        <StarRating
          rating={productRating}
          onRatingChange={setProductRating}
          interactive
          size="lg"
        />
      </div>

      {/* Review Text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-200">
            Your Review (Optional)
          </label>
          <span className="text-xs text-gray-400">Share your experience if you'd like</span>
        </div>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="w-full h-32 px-3 py-2 text-gray-200 bg-gray-800 rounded-lg border border-gray-700 
                     focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
          placeholder="Write your review here..."
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{reviewText.length}/1000</span>
          {reviewText.length > 0 && (
            <span>{reviewText.length < 10 ? 'Minimum 10 characters' : ''}</span>
          )}
        </div>
      </div>

      {/* Merchant Feedback */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">
          Rate the Merchant
        </label>
        <div className="bg-gray-800 rounded-lg p-4">
          <MerchantFeedback 
            merchantId={merchantId} 
            showTitle={false}
          />
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 text-white bg-secondary rounded-lg hover:bg-secondary-dark 
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
} 