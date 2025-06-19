import { supabase } from '../lib/supabase';
import type { 
  ProductReview, 
  ReviewStats, 
  ReviewFormData, 
  ReviewPermissionCheck,
  FormattedReview 
} from '../types/reviews';

class ReviewService {
  
  // Helper to make authenticated RPC calls with wallet headers
  private async makeWalletAuthenticatedRPC(
    functionName: string, 
    params: Record<string, any>,
    walletAddress: string,
    walletAuthToken: string
  ) {
    if (!walletAddress || !walletAuthToken) {
      throw new Error('Wallet authentication required');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        },
        body: JSON.stringify(params)
      }
    );

    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.status}`);
    }

    return response.json();
  }

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

  async getProductStats(productId: string): Promise<ReviewStats> {
    const { data, error } = await supabase
      .rpc('get_product_review_stats', {
        p_product_id: productId
      });

    if (error) throw error;

    // If no stats found, return default
    if (!data) {
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

    // The function returns a JSONB object directly, not an array
    return {
      totalReviews: data.total_reviews || 0,
      averageRating: data.average_rating || 0,
      ratingDistribution: {
        '1': data.rating_distribution?.['1'] || 0,
        '2': data.rating_distribution?.['2'] || 0,
        '3': data.rating_distribution?.['3'] || 0,
        '4': data.rating_distribution?.['4'] || 0,
        '5': data.rating_distribution?.['5'] || 0
      },
      recentReviews: data.recent_reviews || []
    };
  }

  async submitReview(productId: string, orderId: string, data: ReviewFormData, walletAddress?: string, walletAuthToken?: string): Promise<ProductReview> {
    // If wallet context is provided, use authenticated RPC
    if (walletAddress && walletAuthToken) {
      const result = await this.makeWalletAuthenticatedRPC('submit_product_review', {
        p_order_id: orderId,
        p_product_id: productId,
        p_product_rating: data.productRating,
        p_review_text: data.reviewText || null
      }, walletAddress, walletAuthToken);

      // Check if the function returned an error
      if (!result.success) {
        throw new Error(result.error);
      }

      // Fetch the created review to return it
      const { data: review, error: fetchError } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('id', result.review_id)
        .single();

      if (fetchError) {
        console.error('Error fetching created review:', fetchError);
        throw fetchError;
      }

      return review;
    }

    // Fallback to regular supabase client (will likely fail due to missing wallet_address)
    // This is kept for backward compatibility but may need wallet authentication
    const { data: review, error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        order_id: orderId,
        product_rating: data.productRating,
        review_text: data.reviewText || null
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
    // Update the review - RLS policies will ensure users can only update their own reviews
    // The updated_at field will be automatically set by the database trigger
    const { data: review, error } = await supabase
      .from('product_reviews')
      .update({
        product_rating: data.productRating,
        review_text: data.reviewText || null
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Review update error:', error);
      throw error;
    }
    return review;
  }

  async canUserReview(orderId: string, productId: string, walletAddress?: string, walletAuthToken?: string): Promise<ReviewPermissionCheck> {
    // If wallet context is provided, use authenticated RPC
    if (walletAddress && walletAuthToken) {
      const data = await this.makeWalletAuthenticatedRPC('can_user_review_product', {
        p_order_id: orderId,
        p_product_id: productId
      }, walletAddress, walletAuthToken);
      
      // Transform database response to match TypeScript interface
      const dbResult = data || { can_review: false, reason: 'Unknown error' };
      return {
        canReview: dbResult.can_review || false,
        reason: dbResult.reason || 'Unknown error',
        orderStatus: dbResult.order_status
      };
    }

    // Fallback to regular supabase client
    const { data, error } = await supabase
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
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async deleteReview(reviewId: string): Promise<void> {
    const { error } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
  }
}

// Export singleton instance - security is handled at the order level
export const reviewService = new ReviewService();
export { ReviewService }; 