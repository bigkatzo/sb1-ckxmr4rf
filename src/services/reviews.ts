import { supabase } from '../lib/supabase';
import type { 
  ProductReview, 
  ReviewStats, 
  ReviewFormData, 
  ReviewPermissionCheck,
  FormattedReview 
} from '../types/reviews';

class ReviewService {
  async getProductReviews(productId: string, page = 1, limit = 10): Promise<{
    reviews: FormattedReview[];
    totalCount: number;
  }> {
    const offset = (page - 1) * limit;
    
    // Use the database function for formatted reviews
    const { data: reviews, error } = await supabase
      .rpc('get_product_reviews_formatted', {
        p_product_id: productId,
        p_limit: limit,
        p_offset: offset,
        p_order_by: 'created_at DESC'
      });

    if (error) throw error;

    // Get total count for pagination
    const { count } = await supabase
      .from('product_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    const formattedReviews = (reviews || []).map((review: any) => ({
      id: review.id,
      productRating: review.product_rating,
      reviewText: review.review_text,
      formattedWallet: review.formatted_wallet,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      isVerifiedPurchase: review.is_verified_purchase,
      daysAgo: review.days_ago
    }));

    return {
      reviews: formattedReviews,
      totalCount: count || 0
    };
  }

  async getProductReviewStats(productId: string): Promise<ReviewStats> {
    const { data, error } = await supabase
      .rpc('get_product_review_stats', { p_product_id: productId });

    if (error) throw error;
    
    // Ensure we return a properly formatted ReviewStats object
    return {
      totalReviews: data?.total_reviews || 0,
      averageRating: data?.average_rating || 0,
      ratingDistribution: data?.rating_distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      recentReviews: data?.recent_reviews || []
    };
  }

  async canUserReviewProduct(orderId: string, productId: string): Promise<ReviewPermissionCheck> {
    const { data, error } = await supabase
      .rpc('can_user_review_product', {
        p_order_id: orderId,
        p_product_id: productId
      });

    if (error) throw error;
    
    return {
      canReview: data?.can_review || false,
      reason: data?.reason || 'Unknown error',
      orderStatus: data?.order_status
    };
  }

  async submitReview(orderId: string, productId: string, reviewData: ReviewFormData): Promise<void> {
    const { data, error } = await supabase
      .rpc('submit_product_review', {
        p_order_id: orderId,
        p_product_id: productId,
        p_product_rating: reviewData.productRating,
        p_review_text: reviewData.reviewText
      });

    if (error) throw error;
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to submit review');
    }
  }

  private formatWalletAddress(wallet: string): string {
    if (!wallet || wallet.length < 8) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  }

  private getDaysAgo(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export const reviewService = new ReviewService(); 