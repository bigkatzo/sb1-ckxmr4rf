export interface ProductReview {
  id: string;
  product_id: string;
  order_id: string;
  wallet_address: string;
  product_rating: number; // 1-5
  review_text: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
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
    text: string | null;
    created_at: string;
  }>;
}

export interface ReviewFormData {
  productRating: number;
  reviewText: string | null;
}

export interface FormattedReview {
  id: string;
  productRating: number;
  reviewText: string | null;
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