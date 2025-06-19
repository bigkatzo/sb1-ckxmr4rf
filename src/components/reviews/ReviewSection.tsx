import React, { useState, useEffect } from 'react';
import { ReviewPreview } from './ReviewPreview';
import { reviewService } from '../../services/reviews';
import type { FormattedReview } from '../../types/reviews';

interface ReviewSectionProps {
  productId: string;
}

export function ReviewSection({ productId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [productId, currentPage]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { reviews: newReviews, totalCount: newTotal } = await reviewService.getProductReviews(
        productId,
        currentPage
      );
      setReviews(newReviews);
      setTotalCount(newTotal);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll the reviews section into view when changing pages
    document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div id="reviews-section" className="mt-6">
      <ReviewPreview
        reviews={reviews}
        totalCount={totalCount}
        page={currentPage}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
} 