import type { 
  ProductReview, 
  ReviewStats, 
  ReviewFormData, 
  ReviewPermissionCheck,
  FormattedReview 
} from '../types/reviews';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

class ReviewService {
  constructor(private client: SupabaseClient<Database>) {}

  async getProductReviews(productId: string, page = 1, limit = 10): Promise<{
    reviews: FormattedReview[];
    totalCount: number;
  }> {
    const offset = (page - 1) * limit;
    
    // Use the database function for formatted reviews
    const { data: reviews, error } = await this.client
      .rpc('get_product_reviews_formatted', {
        p_product_id: productId,
        p_limit: limit,
        p_offset: offset,
        p_order_by: 'created_at DESC'
      });

    if (error) throw error;

    // Get total count for pagination
    const { count } = await this.client
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

  async getProductStats(productId: string): Promise<ReviewStats> {
    const { data, error } = await this.client
      .rpc('get_product_review_stats', {
        p_product_id: productId
      });

    if (error) throw error;

    // If no stats found, return default
    if (!data || data.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0
        }
      };
    }

    const stats = data[0];
    return {
      totalReviews: stats.total_reviews || 0,
      averageRating: stats.average_rating || 0,
      ratingDistribution: {
        '1': stats.rating_1_count || 0,
        '2': stats.rating_2_count || 0,
        '3': stats.rating_3_count || 0,
        '4': stats.rating_4_count || 0,
        '5': stats.rating_5_count || 0
      }
    };
  }

  async submitReview(productId: string, orderId: string, data: ReviewFormData): Promise<ProductReview> {
    // Check if review already exists first
    const existing = await this.getUserReview(productId, orderId);
    if (existing) {
      throw new Error('You have already reviewed this product. Please use the edit option instead.');
    }

    // Use direct table access for now since the function doesn't handle auth properly in this context
    const { data: review, error } = await this.client
      .from('product_reviews')
      .insert({
        product_id: productId,
        order_id: orderId,
        product_rating: data.productRating,
        review_text: data.reviewText
        // wallet_address will be set by RLS trigger
      })
      .select()
      .single();

    if (error) {
      console.error('Review submission error:', error);
      throw error;
    }
    return review;
  }

  async updateReview(reviewId: string, data: ReviewFormData): Promise<ProductReview> {
    const { data: review, error } = await this.client
      .from('product_reviews')
      .update({
        product_rating: data.productRating,
        review_text: data.reviewText,
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return review;
  }

  async canUserReview(orderId: string, productId: string): Promise<ReviewPermissionCheck> {
    const { data, error } = await this.client
      .rpc('can_user_review_product', {
        p_order_id: orderId,
        p_product_id: productId
      });

    if (error) throw error;
    
    // Transform database response to match TypeScript interface
    const dbResult = data || { can_review: false, reason: 'Unknown error' };
    return {
      canReview: dbResult.can_review || false,
      reason: dbResult.reason || 'Unknown error',
      orderStatus: dbResult.order_status
    };
  }

  async getUserReview(productId: string, orderId: string): Promise<ProductReview | null> {
    const { data, error } = await this.client
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async deleteReview(reviewId: string): Promise<void> {
    const { error } = await this.client
      .from('product_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
  }
}

// Export the ReviewService class for creating instances with wallet clients
export { ReviewService }; 