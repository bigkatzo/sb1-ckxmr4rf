import React from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { StarRating } from './StarRating';
import type { ReviewStats as ReviewStatsType } from '../../types/reviews';

interface ReviewStatsProps {
  stats: ReviewStatsType;
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

      {/* Recent Reviews Preview */}
      {stats.recentReviews && stats.recentReviews.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white mb-2">Recent Reviews</h4>
          <div className="space-y-3">
            {stats.recentReviews.map((review, index) => (
              <div key={index} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating rating={review.rating} size="sm" />
                  <span className="text-gray-400">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-300 line-clamp-2">{review.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 