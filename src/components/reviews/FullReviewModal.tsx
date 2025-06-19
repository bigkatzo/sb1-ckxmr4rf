import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { ReviewStats } from './ReviewStats';
import { StarRating } from './StarRating';
import { Shield, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import type { ReviewStats as ReviewStatsType, FormattedReview } from '../../types/reviews';
import { formatDistanceToNow } from 'date-fns';

interface FullReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  stats: ReviewStatsType;
}

const REVIEWS_PER_PAGE = 10;

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

const sortOptions: Record<SortOption, { label: string, value: string }> = {
  newest: { label: 'Newest First', value: 'created_at DESC' },
  oldest: { label: 'Oldest First', value: 'created_at ASC' },
  highest: { label: 'Highest Rated', value: 'rating DESC' },
  lowest: { label: 'Lowest Rated', value: 'rating ASC' }
};

export function FullReviewModal({
  isOpen,
  onClose,
  productId,
  stats
}: FullReviewModalProps) {
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReviews(true);
    } else {
      // Reset state when modal closes
      setReviews([]);
      setSortBy('newest');
      setPage(1);
      setHasMore(true);
    }
  }, [isOpen, productId]);

  useEffect(() => {
    if (isOpen) {
      loadReviews(true);
    }
  }, [sortBy]);

  const loadReviews = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const data = await reviewService.getProductReviews(
        productId,
        currentPage,
        REVIEWS_PER_PAGE,
        sortOptions[sortBy].value
      );

      setReviews(prev => reset ? data.reviews : [...prev, ...data.reviews]);
      setHasMore(data.reviews.length === REVIEWS_PER_PAGE);
      
      if (!reset) {
        setPage(p => p + 1);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadReviews(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Product Reviews"
      className="z-[60]"
    >
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-auto">
        <div className="p-6 space-y-6">
          {/* Review Statistics */}
          <ReviewStats stats={stats} />

          {/* Sort Controls */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <h3 className="text-lg font-medium text-white">All Reviews</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(sortOptions).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-800 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <>
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
                          <span>{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</span>
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
                          {review.isVerifiedPurchase && (
                            <span className="text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Load More Reviews
                    </button>
                  </div>
                )}
              </>
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