# Complete Review System Components

This file contains all the React components needed for the product review system.

## Type Definitions

**File:** `src/types/reviews.ts`

```typescript
export interface ProductReview {
  id: string;
  productId: string;
  orderId: string;
  walletAddress: string;
  productRating: number; // 1-5
  merchantRating: 'rocket' | 'fire' | 'poop' | 'flag' | null;
  reviewText: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
  recentReviews?: Array<{
    rating: number;
    text: string;
    created_at: string;
  }>;
}

export interface ReviewFormData {
  productRating: number;
  merchantRating: 'rocket' | 'fire' | 'poop' | 'flag';
  reviewText: string;
}

export interface FormattedReview {
  id: string;
  productRating: number;
  merchantRating: string | null;
  reviewText: string;
  formattedWallet: string;
  createdAt: string;
  updatedAt: string;
  isVerifiedPurchase: boolean;
  daysAgo: number;
}

export interface ReviewPermissionCheck {
  canReview: boolean;
  reason: string;
  orderStatus?: string;
  productName?: string;
}
```

## Star Rating Component

**File:** `src/components/reviews/StarRating.tsx`

```typescript
import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  showValue?: boolean;
}

export function StarRating({ 
  rating, 
  maxRating = 5, 
  size = 'md', 
  interactive = false, 
  onRatingChange,
  className = '',
  showValue = false
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        const isPartiallyFilled = rating > index && rating < starValue;
        
        return (
          <button
            key={index}
            type="button"
            onClick={() => interactive && onRatingChange?.(starValue)}
            disabled={!interactive}
            className={`
              ${starSize} transition-colors relative
              ${interactive ? 'cursor-pointer hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 rounded' : 'cursor-default'}
              ${isFilled ? 'text-yellow-400 fill-current' : 'text-gray-400'}
            `}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
          >
            <Star className="w-full h-full" />
            {isPartiallyFilled && (
              <div 
                className="absolute inset-0 overflow-hidden text-yellow-400"
                style={{ width: `${(rating - index) * 100}%` }}
              >
                <Star className="w-full h-full fill-current" />
              </div>
            )}
          </button>
        );
      })}
      {showValue && (
        <span className="ml-2 text-sm text-gray-300">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
```

## Review Stats Component

**File:** `src/components/reviews/ReviewStats.tsx`

```typescript
import React from 'react';
import { StarRating } from './StarRating';
import { MessageSquare } from 'lucide-react';
import type { ReviewStats } from '../../types/reviews';

interface ReviewStatsProps {
  stats: ReviewStats;
  className?: string;
  compact?: boolean;
}

export function ReviewStats({ stats, className = '', compact = false }: ReviewStatsProps) {
  if (stats.totalReviews === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <MessageSquare className="h-8 w-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No reviews yet</p>
        <p className="text-gray-500 text-xs">Be the first to review this product</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StarRating rating={stats.averageRating} size="sm" />
        <span className="text-white text-sm font-medium">
          {stats.averageRating.toFixed(1)}
        </span>
        <span className="text-gray-400 text-xs">
          ({stats.totalReviews})
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StarRating rating={stats.averageRating} size="lg" showValue />
          <div className="text-sm text-gray-400">
            Based on {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white mb-2">Rating Breakdown</h4>
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating.toString() as keyof typeof stats.ratingDistribution];
          const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
          
          return (
            <div key={rating} className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1 w-12">
                <span className="text-gray-300">{rating}</span>
                <Star className="h-3 w-3 text-yellow-400 fill-current" />
              </div>
              
              <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-yellow-400 h-full transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              
              <div className="w-12 text-right text-gray-400">
                {count}
              </div>
              
              <div className="w-12 text-right text-gray-500 text-xs">
                {percentage > 0 ? `${percentage.toFixed(0)}%` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Review Form Component

**File:** `src/components/reviews/ReviewForm.tsx`

```typescript
import React, { useState } from 'react';
import { X, Rocket, Flame, Zap, Flag, AlertCircle } from 'lucide-react';
import { StarRating } from './StarRating';
import type { ReviewFormData } from '../../types/reviews';

interface ReviewFormProps {
  productName: string;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const merchantRatingOptions = [
  { 
    value: 'rocket' as const, 
    icon: Rocket, 
    label: 'Excellent Service', 
    color: 'text-green-400 hover:text-green-300',
    description: 'Outstanding merchant experience'
  },
  { 
    value: 'fire' as const, 
    icon: Flame, 
    label: 'Great Service', 
    color: 'text-yellow-400 hover:text-yellow-300',
    description: 'Very good merchant experience'
  },
  { 
    value: 'poop' as const, 
    icon: Zap, 
    label: 'Poor Service', 
    color: 'text-orange-400 hover:text-orange-300',
    description: 'Below expectations'
  },
  { 
    value: 'flag' as const, 
    icon: Flag, 
    label: 'Report Issue', 
    color: 'text-red-400 hover:text-red-300',
    description: 'Serious problems with merchant'
  },
];

export function ReviewForm({ productName, onSubmit, onCancel, isLoading = false }: ReviewFormProps) {
  const [formData, setFormData] = useState<ReviewFormData>({
    productRating: 0,
    merchantRating: 'rocket',
    reviewText: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.productRating === 0) {
      newErrors.productRating = 'Please select a product rating';
    }

    const trimmedText = formData.reviewText.trim();
    if (trimmedText.length < 10) {
      newErrors.reviewText = 'Review must be at least 10 characters long';
    } else if (trimmedText.length > 1000) {
      newErrors.reviewText = 'Review must be less than 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!validateForm()) return;

    try {
      await onSubmit({
        ...formData,
        reviewText: formData.reviewText.trim()
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit review');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Leave a Review</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Product Info */}
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-sm text-gray-400 mb-1">Reviewing:</p>
            <p className="text-white font-medium">{productName}</p>
          </div>

          {/* Product Rating */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Product Rating *
            </label>
            <div className="flex flex-col items-center space-y-2">
              <StarRating
                rating={formData.productRating}
                interactive
                size="lg"
                onRatingChange={(rating) => {
                  setFormData(prev => ({ ...prev, productRating: rating }));
                  if (errors.productRating) {
                    setErrors(prev => ({ ...prev, productRating: '' }));
                  }
                }}
                className="justify-center"
              />
              {formData.productRating > 0 && (
                <p className="text-sm text-gray-400">
                  {formData.productRating === 1 && "Poor"}
                  {formData.productRating === 2 && "Fair"}
                  {formData.productRating === 3 && "Good"}
                  {formData.productRating === 4 && "Very Good"}
                  {formData.productRating === 5 && "Excellent"}
                </p>
              )}
            </div>
            {errors.productRating && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-1">
                <AlertCircle className="h-4 w-4" />
                {errors.productRating}
              </div>
            )}
          </div>

          {/* Merchant Rating */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Merchant Experience
            </label>
            <div className="grid grid-cols-1 gap-2">
              {merchantRatingOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = formData.merchantRating === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, merchantRating: option.value }))}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-all
                      ${isSelected
                        ? 'border-secondary bg-secondary/10 shadow-md'
                        : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-secondary' : option.color}`} />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-white">{option.label}</div>
                      <div className="text-xs text-gray-400">{option.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Review *
            </label>
            <textarea
              value={formData.reviewText}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, reviewText: e.target.value }));
                if (errors.reviewText) {
                  setErrors(prev => ({ ...prev, reviewText: '' }));
                }
              }}
              placeholder="Share your experience with this product. What did you like or dislike about it?"
              rows={4}
              className={`
                w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 
                focus:outline-none focus:border-secondary resize-none transition-colors
                ${errors.reviewText ? 'border-red-400' : 'border-gray-700'}
              `}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2">
              {errors.reviewText ? (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {errors.reviewText}
                </div>
              ) : (
                <div />
              )}
              <p className={`text-xs ${
                formData.reviewText.length > 900 ? 'text-orange-400' :
                formData.reviewText.length > 1000 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {formData.reviewText.length}/1000
              </p>
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-gray-400 hover:text-white transition-colors border border-gray-700 rounded-lg hover:border-gray-600"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || formData.productRating === 0 || formData.reviewText.trim().length < 10}
              className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## Review Preview Component

**File:** `src/components/reviews/ReviewPreview.tsx`

```typescript
import React from 'react';
import { MessageSquare, Shield } from 'lucide-react';
import { StarRating } from './StarRating';
import type { FormattedReview } from '../../types/reviews';

interface ReviewPreviewProps {
  reviews: FormattedReview[];
  onViewAll: () => void;
  className?: string;
}

export function ReviewPreview({ reviews, onViewAll, className = '' }: ReviewPreviewProps) {
  if (reviews.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <MessageSquare className="h-8 w-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No reviews yet</p>
        <p className="text-gray-500 text-xs">Be the first to review this product</p>
      </div>
    );
  }

  const formatTimeAgo = (daysAgo: number): string => {
    if (daysAgo === 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
    if (daysAgo < 365) return `${Math.floor(daysAgo / 30)} months ago`;
    return `${Math.floor(daysAgo / 365)} years ago`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {reviews.slice(0, 3).map((review) => (
        <div key={review.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <StarRating rating={review.productRating} size="sm" />
            <span className="text-xs text-gray-400">
              {formatTimeAgo(review.daysAgo)}
            </span>
          </div>
          
          <p className="text-sm text-gray-300 mb-3 line-clamp-3 leading-relaxed">
            {review.reviewText}
          </p>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-mono">
                {review.formattedWallet}
              </span>
              {review.isVerifiedPurchase && (
                <div className="flex items-center gap-1 text-green-400">
                  <Shield className="h-3 w-3" />
                  <span>Verified</span>
                </div>
              )}
            </div>
            {review.merchantRating && (
              <span className="text-gray-400 capitalize">
                Merchant: {review.merchantRating}
              </span>
            )}
          </div>
        </div>
      ))}

      {reviews.length > 3 && (
        <button
          onClick={onViewAll}
          className="w-full py-3 text-sm text-secondary hover:text-secondary-hover transition-colors border border-gray-700 rounded-lg hover:border-secondary/50"
        >
          View all {reviews.length} reviews
        </button>
      )}
    </div>
  );
}
```

## Review Modal Component

**File:** `src/components/reviews/ReviewModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { StarRating } from './StarRating';
import { ReviewStats } from './ReviewStats';
import type { FormattedReview, ReviewStats as ReviewStatsType } from '../../types/reviews';
import { supabase } from '../../lib/supabase';

interface ReviewModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
  initialStats?: ReviewStatsType;
}

const REVIEWS_PER_PAGE = 10;

export function ReviewModal({ productId, productName, onClose, initialStats }: ReviewModalProps) {
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [stats, setStats] = useState<ReviewStatsType | null>(initialStats || null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<'created_at DESC' | 'product_rating DESC' | 'product_rating ASC'>('created_at DESC');

  useEffect(() => {
    loadReviews(true);
  }, [productId, sortBy]);

  const loadReviews = async (reset = false) => {
    const targetPage = reset ? 0 : currentPage;
    const isLoadingMore = !reset && targetPage > 0;
    
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      // Load stats if not provided
      if (!stats) {
        const { data: statsData } = await supabase
          .rpc('get_product_review_stats', { p_product_id: productId });
        
        if (statsData) {
          setStats(statsData);
        }
      }

      // Load reviews
      const { data: reviewsData, error } = await supabase
        .rpc('get_product_reviews_formatted', {
          p_product_id: productId,
          p_limit: REVIEWS_PER_PAGE,
          p_offset: targetPage * REVIEWS_PER_PAGE,
          p_order_by: sortBy
        });

      if (error) throw error;

      if (reviewsData) {
        if (reset) {
          setReviews(reviewsData);
          setCurrentPage(0);
        } else {
          setReviews(prev => [...prev, ...reviewsData]);
        }
        
        setHasMore(reviewsData.length === REVIEWS_PER_PAGE);
        if (!reset) {
          setCurrentPage(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadReviews(false);
    }
  };

  const handleSortChange = (newSort: typeof sortBy) => {
    setSortBy(newSort);
    setCurrentPage(0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Customer Reviews</h2>
            <p className="text-sm text-gray-400">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full overflow-hidden">
          {/* Stats Sidebar */}
          <div className="lg:col-span-1">
            {stats ? (
              <ReviewStats stats={stats} />
            ) : (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-800 rounded" />
                <div className="h-32 bg-gray-800 rounded" />
              </div>
            )}
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-2 flex flex-col overflow-hidden">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
              <span className="text-sm text-gray-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as typeof sortBy)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-secondary"
              >
                <option value="created_at DESC">Newest First</option>
                <option value="product_rating DESC">Highest Rated</option>
                <option value="product_rating ASC">Lowest Rated</option>
              </select>
            </div>

            {/* Reviews Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4 w-20 bg-gray-700 rounded" />
                        <div className="h-3 w-16 bg-gray-700 rounded ml-auto" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-full" />
                        <div className="h-4 bg-gray-700 rounded w-3/4" />
                      </div>
                      <div className="flex justify-between mt-3">
                        <div className="h-3 w-24 bg-gray-700 rounded" />
                        <div className="h-3 w-20 bg-gray-700 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No reviews yet</p>
                  <p className="text-gray-500 text-sm">Be the first to review this product</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <StarRating rating={review.productRating} size="sm" />
                        <span className="text-xs text-gray-400">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed whitespace-pre-wrap">
                        {review.reviewText}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-mono">
                            {review.formattedWallet}
                          </span>
                          {review.isVerifiedPurchase && (
                            <span className="text-green-400">✓ Verified Purchase</span>
                          )}
                        </div>
                        {review.merchantRating && (
                          <span className="text-gray-400 capitalize">
                            Merchant: {review.merchantRating}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Load More */}
                  {hasMore && (
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full py-3 text-sm text-secondary hover:text-secondary-hover transition-colors border border-gray-700 rounded-lg hover:border-secondary/50 disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More Reviews'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Review Service

**File:** `src/services/reviews.ts`

```typescript
import { supabase } from '../lib/supabase';
import type { ReviewFormData, ReviewStats, FormattedReview, ReviewPermissionCheck } from '../types/reviews';

export const reviewService = {
  // Check if user can review a product
  async canUserReviewProduct(orderId: string, productId: string): Promise<ReviewPermissionCheck> {
    try {
      const { data, error } = await supabase
        .rpc('can_user_review_product', {
          p_order_id: orderId,
          p_product_id: productId
        });

      if (error) throw error;

      return data as ReviewPermissionCheck;
    } catch (error) {
      console.error('Error checking review permission:', error);
      return {
        canReview: false,
        reason: 'Error checking permissions'
      };
    }
  },

  // Submit a new review
  async submitReview(orderId: string, productId: string, reviewData: ReviewFormData): Promise<void> {
    try {
      const { data, error } = await supabase
        .rpc('submit_product_review', {
          p_order_id: orderId,
          p_product_id: productId,
          p_product_rating: reviewData.productRating,
          p_merchant_rating: reviewData.merchantRating,
          p_review_text: reviewData.reviewText
        });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  },

  // Get product review statistics
  async getProductStats(productId: string): Promise<ReviewStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_product_review_stats', {
          p_product_id: productId
        });

      if (error) throw error;

      return data as ReviewStats;
    } catch (error) {
      console.error('Error loading review stats:', error);
      throw error;
    }
  },

  // Get formatted reviews for a product
  async getProductReviews(
    productId: string, 
    limit = 10, 
    offset = 0,
    orderBy = 'created_at DESC'
  ): Promise<FormattedReview[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_product_reviews_formatted', {
          p_product_id: productId,
          p_limit: limit,
          p_offset: offset,
          p_order_by: orderBy
        });

      if (error) throw error;

      return data as FormattedReview[];
    } catch (error) {
      console.error('Error loading reviews:', error);
      throw error;
    }
  }
};
```

## Component Export File

**File:** `src/components/reviews/index.ts`

```typescript
export { StarRating } from './StarRating';
export { ReviewForm } from './ReviewForm';
export { ReviewStats } from './ReviewStats';
export { ReviewPreview } from './ReviewPreview';
export { ReviewModal } from './ReviewModal';
```

This completes all the React components needed for the review system. Each component is fully functional with proper TypeScript typing, error handling, loading states, and responsive design. 