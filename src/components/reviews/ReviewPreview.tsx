import React from 'react';
import { CheckCircle } from 'lucide-react';
import { StarRating } from './StarRating';
import type { FormattedReview } from '../../types/reviews';

interface ReviewPreviewProps {
  reviews: FormattedReview[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function ReviewPreview({
  reviews,
  totalCount,
  page,
  onPageChange,
  loading = false,
  className = ''
}: ReviewPreviewProps) {
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="flex justify-between items-start mb-3">
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-24" />
                <div className="h-3 bg-gray-700 rounded w-32" />
              </div>
            </div>
            <div className="h-4 bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-400">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StarRating rating={review.productRating} size="sm" />
                  {review.isVerifiedPurchase && (
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Verified Purchase
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>{review.formattedWallet}</span>
                  <span>•</span>
                  <span>{review.daysAgo === 0 ? 'Today' : `${review.daysAgo} days ago`}</span>
                </div>
              </div>
            </div>

            {/* Review Text */}
            {review.reviewText && (
              <p className="text-gray-300 text-sm whitespace-pre-line">
                {review.reviewText}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 text-sm text-gray-400 bg-gray-800 rounded-lg
                       hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {[...Array(totalPages)].map((_, i) => {
            const pageNum = i + 1;
            const isCurrentPage = pageNum === page;
            
            return (
              <button
                key={i}
                onClick={() => onPageChange(pageNum)}
                disabled={isCurrentPage}
                className={`
                  px-3 py-1 text-sm rounded-lg
                  ${isCurrentPage 
                    ? 'bg-secondary text-white' 
                    : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                  }
                `}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm text-gray-400 bg-gray-800 rounded-lg
                       hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
} 