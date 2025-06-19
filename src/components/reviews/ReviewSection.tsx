import { useState, useEffect } from 'react';
import { CompactReviewSection } from './CompactReviewSection';
import { reviewService } from '../../services/reviews';
import type { ReviewStats } from '../../types/reviews';

interface ReviewSectionProps {
  productId: string;
  orderId?: string;
  className?: string;
}

export function ReviewSection({ productId, orderId, className = '' }: ReviewSectionProps) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const statsData = await reviewService.getProductStats(productId);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load review data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-800 h-32 rounded-lg" />;
  }

  if (!stats || stats.totalReviews === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-400">No reviews yet. Be the first to review!</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <CompactReviewSection
        productId={productId}
        orderId={orderId}
        stats={stats}
      />
    </div>
  );
} 