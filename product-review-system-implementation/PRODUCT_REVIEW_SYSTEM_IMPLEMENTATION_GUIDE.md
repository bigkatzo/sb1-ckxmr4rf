# Product Review System - Complete Implementation Guide

## 📋 Overview

This is a comprehensive implementation guide for adding a product review system to your e-commerce platform. Users can leave reviews for delivered products, rating both the product (1-5 stars) and merchant experience (emoji system).

**Estimated Implementation Time: 24-30 hours**

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Database     │
│                 │    │                  │    │                 │
│ • ReviewForm    │◄──►│ • RLS Policies   │◄──►│ product_reviews │
│ • ReviewStats   │    │ • Functions      │    │ • Indexes       │
│ • ReviewPreview │    │ • Permissions    │    │ • Constraints   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 📚 Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Database Implementation](#database-implementation)
3. [Backend Functions](#backend-functions)
4. [Frontend Components](#frontend-components)
5. [Integration Points](#integration-points)
6. [Testing Guide](#testing-guide)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Prerequisites & Setup

### Required Knowledge
- ✅ PostgreSQL/Supabase
- ✅ React/TypeScript
- ✅ Your existing codebase structure

### File Structure We'll Create
```
src/
├── components/reviews/
│   ├── StarRating.tsx
│   ├── ReviewForm.tsx
│   ├── ReviewStats.tsx
│   ├── ReviewPreview.tsx
│   └── ReviewModal.tsx
├── types/
│   └── reviews.ts
└── services/
    └── reviews.ts

supabase/migrations/
├── YYYYMMDD_create_product_reviews.sql
└── YYYYMMDD_product_review_functions.sql
```

---

## 🗄️ Database Implementation

### Step 1: Create Product Reviews Table

**File:** `supabase/migrations/20241201000000_create_product_reviews.sql`

```sql
-- ==========================================
-- PRODUCT REVIEW SYSTEM - CORE TABLES
-- ==========================================

BEGIN;

-- Create product_reviews table
CREATE TABLE product_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    wallet_address text NOT NULL,
    
    -- Rating system
    product_rating integer NOT NULL CHECK (product_rating >= 1 AND product_rating <= 5),
    merchant_rating text CHECK (merchant_rating IN ('rocket', 'fire', 'poop', 'flag')),
    
    -- Review content
    review_text text NOT NULL CHECK (
        length(trim(review_text)) >= 10 AND 
        length(trim(review_text)) <= 1000
    ),
    
    -- Metadata
    is_verified_purchase boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Business constraints
    UNIQUE(order_id, product_id) -- One review per product per order
);

-- Performance indexes
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_wallet_address ON product_reviews(wallet_address);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);
CREATE INDEX idx_product_reviews_rating ON product_reviews(product_rating);

-- Composite index for common queries
CREATE INDEX idx_product_reviews_product_rating ON product_reviews(product_id, product_rating);

-- Enable Row Level Security
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read product reviews" 
ON product_reviews FOR SELECT 
USING (true);

CREATE POLICY "Wallet owners can create reviews for delivered orders" 
ON product_reviews FOR INSERT 
WITH CHECK (
    wallet_address = auth.current_user_wallet_address() AND
    EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = order_id 
        AND o.wallet_address = wallet_address
        AND o.status = 'delivered'
        AND o.product_id = product_id
    )
);

CREATE POLICY "Review authors can update their own reviews" 
ON product_reviews FOR UPDATE 
USING (
    wallet_address = auth.current_user_wallet_address() AND
    created_at > (now() - interval '24 hours') -- Allow edits within 24 hours
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_product_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_reviews_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_product_reviews_updated_at();

COMMIT;
```

### Step 2: Apply Migration

```bash
# Navigate to your project directory
cd /Users/arik/storedotfun\ code/sb1-ckxmr4rf

# Apply the migration
supabase migration up
```

---

## ⚙️ Backend Functions

### Step 3: Create Database Functions

**File:** `supabase/migrations/20241201000001_product_review_functions.sql`

```sql
-- ==========================================
-- PRODUCT REVIEW SYSTEM - FUNCTIONS
-- ==========================================

BEGIN;

-- Function: Get comprehensive review statistics for a product
CREATE OR REPLACE FUNCTION get_product_review_stats(p_product_id uuid)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    total_count integer;
    avg_rating numeric;
BEGIN
    -- Get aggregate data
    SELECT 
        COUNT(*)::integer,
        COALESCE(ROUND(AVG(product_rating::numeric), 1), 0)
    INTO total_count, avg_rating
    FROM product_reviews
    WHERE product_id = p_product_id;
    
    -- Build comprehensive result
    SELECT jsonb_build_object(
        'total_reviews', total_count,
        'average_rating', avg_rating,
        'rating_distribution', jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE product_rating = 5),
            '4', COUNT(*) FILTER (WHERE product_rating = 4),
            '3', COUNT(*) FILTER (WHERE product_rating = 3),
            '2', COUNT(*) FILTER (WHERE product_rating = 2),
            '1', COUNT(*) FILTER (WHERE product_rating = 1)
        ),
        'recent_reviews', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'rating', product_rating,
                    'text', review_text,
                    'created_at', created_at
                ) ORDER BY created_at DESC
            )
            FROM (
                SELECT product_rating, review_text, created_at
                FROM product_reviews
                WHERE product_id = p_product_id
                ORDER BY created_at DESC
                LIMIT 3
            ) recent
        )
    ) INTO result
    FROM product_reviews
    WHERE product_id = p_product_id;
    
    -- Return default if no reviews
    RETURN COALESCE(result, jsonb_build_object(
        'total_reviews', 0,
        'average_rating', 0,
        'rating_distribution', jsonb_build_object('5', 0, '4', 0, '3', 0, '2', 0, '1', 0),
        'recent_reviews', '[]'::jsonb
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can review a specific product from an order
CREATE OR REPLACE FUNCTION can_user_review_product(p_order_id uuid, p_product_id uuid)
RETURNS jsonb AS $$
DECLARE
    order_record record;
    current_wallet text;
    can_review boolean := false;
    reason text := '';
BEGIN
    -- Get current user's wallet
    current_wallet := auth.current_user_wallet_address();
    
    IF current_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'can_review', false,
            'reason', 'Not authenticated'
        );
    END IF;
    
    -- Get order details
    SELECT o.*, p.name as product_name
    INTO order_record
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.id = p_order_id AND o.product_id = p_product_id;
    
    -- Check various conditions
    IF order_record.id IS NULL THEN
        reason := 'Order not found';
    ELSIF order_record.wallet_address != current_wallet THEN
        reason := 'Order does not belong to current user';
    ELSIF order_record.status != 'delivered' THEN
        reason := 'Order must be delivered to leave a review';
    ELSIF EXISTS (
        SELECT 1 FROM product_reviews 
        WHERE order_id = p_order_id AND product_id = p_product_id
    ) THEN
        reason := 'Review already exists for this order';
    ELSE
        can_review := true;
        reason := 'Can leave review';
    END IF;
    
    RETURN jsonb_build_object(
        'can_review', can_review,
        'reason', reason,
        'order_status', order_record.status,
        'product_name', order_record.product_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get formatted reviews with privacy-protected wallet addresses
CREATE OR REPLACE FUNCTION get_product_reviews_formatted(
    p_product_id uuid,
    p_limit integer DEFAULT 10,
    p_offset integer DEFAULT 0,
    p_order_by text DEFAULT 'created_at DESC'
)
RETURNS TABLE (
    id uuid,
    product_rating integer,
    merchant_rating text,
    review_text text,
    formatted_wallet text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_verified_purchase boolean,
    days_ago integer
) AS $$
BEGIN
    RETURN QUERY
    EXECUTE format('
        SELECT 
            pr.id,
            pr.product_rating,
            pr.merchant_rating,
            pr.review_text,
            CASE 
                WHEN length(pr.wallet_address) >= 8 THEN
                    substring(pr.wallet_address, 1, 4) || ''...'' || 
                    substring(pr.wallet_address, length(pr.wallet_address) - 3)
                ELSE pr.wallet_address 
            END as formatted_wallet,
            pr.created_at,
            pr.updated_at,
            pr.is_verified_purchase,
            EXTRACT(days FROM (now() - pr.created_at))::integer as days_ago
        FROM product_reviews pr
        WHERE pr.product_id = $1
        ORDER BY %s
        LIMIT $2 OFFSET $3
    ', p_order_by)
    USING p_product_id, p_limit, p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Submit a new product review
CREATE OR REPLACE FUNCTION submit_product_review(
    p_product_id uuid,
    p_order_id uuid,
    p_product_rating integer,
    p_merchant_rating text,
    p_review_text text
)
RETURNS jsonb AS $$
DECLARE
    current_wallet text;
    review_id uuid;
    can_review_result jsonb;
BEGIN
    -- Get current wallet
    current_wallet := auth.current_user_wallet_address();
    
    -- Check if user can review
    can_review_result := can_user_review_product(p_order_id, p_product_id);
    
    IF NOT (can_review_result->>'can_review')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', can_review_result->>'reason'
        );
    END IF;
    
    -- Validate input
    IF p_product_rating < 1 OR p_product_rating > 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Product rating must be between 1 and 5'
        );
    END IF;
    
    IF p_merchant_rating IS NOT NULL AND 
       p_merchant_rating NOT IN ('rocket', 'fire', 'poop', 'flag') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid merchant rating'
        );
    END IF;
    
    IF length(trim(p_review_text)) < 10 OR length(trim(p_review_text)) > 1000 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Review text must be between 10 and 1000 characters'
        );
    END IF;
    
    -- Insert review
    INSERT INTO product_reviews (
        product_id,
        order_id,
        wallet_address,
        product_rating,
        merchant_rating,
        review_text
    ) VALUES (
        p_product_id,
        p_order_id,
        current_wallet,
        p_product_rating,
        p_merchant_rating,
        trim(p_review_text)
    ) RETURNING id INTO review_id;
    
    -- Update merchant feedback if merchant rating provided
    IF p_merchant_rating IS NOT NULL THEN
        -- Get merchant ID from product
        DECLARE
            merchant_id uuid;
        BEGIN
            SELECT c.user_id INTO merchant_id
            FROM products p
            JOIN collections c ON c.id = p.collection_id
            WHERE p.id = p_product_id;
            
            IF merchant_id IS NOT NULL THEN
                PERFORM vote_merchant_feedback(merchant_id, p_merchant_rating);
            END IF;
        END;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'review_id', review_id,
        'message', 'Review submitted successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_product_review_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION can_user_review_product(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_product_reviews_formatted(uuid, integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_product_review(uuid, uuid, integer, text, text) TO anon, authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_product_review_stats(uuid) IS 'Get comprehensive review statistics for a product including rating distribution';
COMMENT ON FUNCTION can_user_review_product(uuid, uuid) IS 'Check if current user can review a product from a specific order';
COMMENT ON FUNCTION get_product_reviews_formatted(uuid, integer, integer, text) IS 'Get formatted product reviews with privacy-protected wallet addresses';
COMMENT ON FUNCTION submit_product_review(uuid, uuid, integer, text, text) IS 'Submit a new product review with validation';

COMMIT;
```

---

## 🎨 Frontend Components

### Step 4: Create Type Definitions

**File:** `src/types/reviews.ts`

```typescript
export interface ProductReview {
  id: string;
  productId: string;
  orderId: string;
  walletAddress: string;
  productRating: number; // 1-5
  merchantRating: 'rocket' | 'fire' | 'poop' | 'flag' | null;
  reviewText: string;
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
    text: string;
    created_at: string;
  }>;
}

export interface ReviewFormData {
  productRating: number;
  merchantRating: 'rocket' | 'fire' | 'poop' | 'flag';
  reviewText: string;
}

export interface FormattedReview {
  id: string;
  productRating: number;
  merchantRating: string | null;
  reviewText: string;
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
```

### Step 5: Create Reusable Star Rating Component

**File:** `src/components/reviews/StarRating.tsx`

```typescript
import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  showValue?: boolean;
}

export function StarRating({ 
  rating, 
  maxRating = 5, 
  size = 'md', 
  interactive = false, 
  onRatingChange,
  className = '',
  showValue = false
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        const isPartiallyFilled = rating > index && rating < starValue;
        
        return (
          <button
            key={index}
            type="button"
            onClick={() => interactive && onRatingChange?.(starValue)}
            disabled={!interactive}
            className={`
              ${starSize} transition-colors relative
              ${interactive ? 'cursor-pointer hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 rounded' : 'cursor-default'}
              ${isFilled ? 'text-yellow-400 fill-current' : 'text-gray-400'}
            `}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
          >
            <Star className="w-full h-full" />
            {isPartiallyFilled && (
              <div 
                className="absolute inset-0 overflow-hidden text-yellow-400"
                style={{ width: `${(rating - index) * 100}%` }}
              >
                <Star className="w-full h-full fill-current" />
              </div>
            )}
          </button>
        );
      })}
      {showValue && (
        <span className="ml-2 text-sm text-gray-300">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
```

### Step 6: Create Review Statistics Component

**File:** `src/components/reviews/ReviewStats.tsx`

```typescript
import React from 'react';
import { StarRating } from './StarRating';
import { MessageSquare } from 'lucide-react';
import type { ReviewStats } from '../../types/reviews';

interface ReviewStatsProps {
  stats: ReviewStats;
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
    </div>
  );
}
```

## Continuing in separate response due to length...

This implementation provides a complete product review system that integrates seamlessly with your existing e-commerce platform. The system ensures data integrity, proper authentication, and excellent user experience.

Would you like me to continue with the remaining components (ReviewForm, ReviewPreview, ReviewModal) and integration points in a separate response, or would you prefer to see this broken into multiple focused files? 