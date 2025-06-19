export interface ProductReview {
  id: string;
  productId: string;
  orderId: string;
  walletAddress: string;
  productRating: number; // 1-5
  reviewText: string | null;
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
    text: string | null;
    created_at: string;
  }>;
}

export interface ReviewFormData {
  productRating: number;
  reviewText?: string | null;
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