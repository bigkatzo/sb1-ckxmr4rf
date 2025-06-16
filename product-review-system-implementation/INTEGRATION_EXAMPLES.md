# Integration Examples for Review System

This file contains complete integration examples for adding the review system to your existing pages.

## Orders Page Integration

**File:** `src/pages/OrdersPage.tsx` (Complete Integration Example)

```typescript
import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { supabase } from '../lib/supabase';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { reviewService } from '../services/reviews';
import { toast } from 'react-hot-toast';
import type { ReviewFormData, ReviewPermissionCheck } from '../types/reviews';

interface Order {
  id: string;
  productId: string;
  productName: string;
  status: 'draft' | 'pending_payment' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  walletAddress: string;
  totalAmount: number;
  createdAt: string;
  // Add other order fields as needed
}

interface OrderWithReviewStatus extends Order {
  hasReview: boolean;
  canReview: boolean;
}

export function OrdersPage() {
  const { walletAddress, isConnected } = useWallet();
  const [orders, setOrders] = useState<OrderWithReviewStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModalData, setReviewModalData] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (isConnected && walletAddress) {
      loadOrders();
    }
  }, [isConnected, walletAddress]);

  const loadOrders = async () => {
    if (!walletAddress) return;

    try {
      setLoading(true);
      
      // Load orders for the current wallet
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          products!inner(name)
        `)
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (ordersData) {
        // Check review status for each order
        const ordersWithReviewStatus = await Promise.all(
          ordersData.map(async (order) => {
            // Check if review already exists
            const { data: existingReview } = await supabase
              .from('product_reviews')
              .select('id')
              .eq('order_id', order.id)
              .eq('product_id', order.product_id)
              .single();

            return {
              id: order.id,
              productId: order.product_id,
              productName: order.products?.name || 'Unknown Product',
              status: order.status,
              walletAddress: order.wallet_address,
              totalAmount: order.total_amount,
              createdAt: order.created_at,
              hasReview: !!existingReview,
              canReview: order.status === 'delivered' && !existingReview
            } as OrderWithReviewStatus;
          })
        );

        setOrders(ordersWithReviewStatus);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = async (order: OrderWithReviewStatus) => {
    try {
      // Double-check permissions before opening form
      const permission = await reviewService.canUserReviewProduct(order.id, order.productId);
      
      if (permission.canReview) {
        setReviewModalData({
          orderId: order.id,
          productId: order.productId,
          productName: order.productName
        });
      } else {
        toast.info(permission.reason);
      }
    } catch (error) {
      console.error('Error checking review permissions:', error);
      toast.error('Unable to check review permissions');
    }
  };

  const handleReviewSubmit = async (reviewData: ReviewFormData) => {
    if (!reviewModalData) return;

    setReviewLoading(true);
    try {
      await reviewService.submitReview(
        reviewModalData.orderId,
        reviewModalData.productId,
        reviewData
      );

      toast.success('Review submitted successfully!');
      setReviewModalData(null);
      
      // Refresh orders to update review status
      await loadOrders();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-400';
      case 'shipped': return 'text-blue-400';
      case 'preparing': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100); // Assuming amount is in cents
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">Please connect your wallet to view your orders</p>
          {/* Add wallet connection button here */}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Orders</h1>
          <p className="text-gray-400">Track your orders and leave reviews</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-48" />
                    <div className="h-3 bg-gray-700 rounded w-32" />
                  </div>
                  <div className="h-6 bg-gray-700 rounded w-20" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-700 rounded w-24" />
                  <div className="h-8 bg-gray-700 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-4">No orders found</div>
            <p className="text-gray-500">Start shopping to see your orders here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {order.productName}
                    </h3>
                    <p className="text-sm text-gray-400">
                      Order #{order.id.slice(0, 8)}...
                    </p>
                  </div>
                  <div className={`text-sm font-medium capitalize ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <span>Ordered: {formatDate(order.createdAt)}</span>
                    <span>Total: {formatAmount(order.totalAmount)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Review Status/Button */}
                    {order.hasReview ? (
                      <span className="text-sm text-green-400 flex items-center gap-1">
                        ✓ Reviewed
                      </span>
                    ) : order.canReview ? (
                      <button
                        onClick={() => handleReviewClick(order)}
                        className="bg-secondary hover:bg-secondary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Leave Review
                      </button>
                    ) : order.status === 'delivered' ? (
                      <span className="text-sm text-gray-500">Review submitted</span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {order.status === 'cancelled' ? 'Cancelled' : 'Pending delivery'}
                      </span>
                    )}

                    {/* View Order Button */}
                    <button className="text-secondary hover:text-secondary-hover text-sm font-medium transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Form Modal */}
        {reviewModalData && (
          <ReviewForm
            productName={reviewModalData.productName}
            onSubmit={handleReviewSubmit}
            onCancel={() => setReviewModalData(null)}
            isLoading={reviewLoading}
          />
        )}
      </div>
    </div>
  );
}
```

## Product Modal Integration

**File:** `src/components/products/ProductModal.tsx` (Complete Integration Example)

```typescript
import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { CompactCreator } from '../CompactCreator';
import { ReviewStats } from '../reviews/ReviewStats';
import { ReviewPreview } from '../reviews/ReviewPreview';
import { ReviewModal } from '../reviews/ReviewModal';
import { reviewService } from '../../services/reviews';
import type { Product } from '../../types/product';
import type { ReviewStats as ReviewStatsType, FormattedReview } from '../../types/reviews';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onPurchase?: (product: Product) => void;
}

export function ProductModal({ product, onClose, onPurchase }: ProductModalProps) {
  const [reviewStats, setReviewStats] = useState<ReviewStatsType | null>(null);
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string>('');

  // Load reviews when product changes
  useEffect(() => {
    if (product?.id) {
      loadReviews();
    } else {
      // Reset state when product is null
      setReviewStats(null);
      setReviews([]);
      setReviewsError('');
    }
  }, [product?.id]);

  const loadReviews = async () => {
    if (!product?.id) return;

    setReviewsLoading(true);
    setReviewsError('');

    try {
      // Load review stats and preview reviews in parallel
      const [statsData, reviewsData] = await Promise.all([
        reviewService.getProductStats(product.id),
        reviewService.getProductReviews(product.id, 10, 0)
      ]);

      setReviewStats(statsData);
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviewsError('Failed to load reviews');
      
      // Set empty state on error
      setReviewStats({
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      });
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handlePurchase = () => {
    if (product && onPurchase) {
      onPurchase(product);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price / 100); // Assuming price is in cents
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!product) return null;

  return (
    <>
      {/* Main Product Modal */}
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40"
        onClick={handleBackdropClick}
      >
        <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
            <h2 className="text-lg font-semibold text-white truncate pr-4">
              {product.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Product Image */}
            {product.imageUrl && (
              <div className="aspect-video w-full bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Product Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-secondary">
                  {formatPrice(product.price)}
                </div>
                {product.externalUrl && (
                  <a
                    href={product.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-secondary-hover text-sm flex items-center gap-1 transition-colors"
                  >
                    View Product <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {product.description && (
                <div className="text-gray-300">
                  <h3 className="text-white font-medium mb-2">Description</h3>
                  <p className="leading-relaxed">{product.description}</p>
                </div>
              )}
            </div>

            {/* Creator Section */}
            {product.creator && (
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-white font-medium mb-3">Creator</h3>
                <CompactCreator creator={product.creator} />
              </div>
            )}

            {/* Reviews Section */}
            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-white font-medium mb-4">Customer Reviews</h3>
              
              {reviewsLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-16 bg-gray-800 rounded" />
                  <div className="h-24 bg-gray-800 rounded" />
                  <div className="h-24 bg-gray-800 rounded" />
                </div>
              ) : reviewsError ? (
                <div className="text-center py-6 text-red-400">
                  <p>{reviewsError}</p>
                  <button
                    onClick={loadReviews}
                    className="mt-2 text-secondary hover:text-secondary-hover text-sm"
                  >
                    Try Again
                  </button>
                </div>
              ) : reviewStats ? (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                  <ReviewStats stats={reviewStats} compact />
                  <ReviewPreview 
                    reviews={reviews}
                    onViewAll={() => setShowAllReviews(true)}
                  />
                </div>
              ) : null}
            </div>

            {/* Purchase Button */}
            {onPurchase && (
              <div className="border-t border-gray-800 pt-4">
                <button
                  onClick={handlePurchase}
                  className="w-full bg-secondary hover:bg-secondary-hover text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Purchase Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Reviews Modal */}
      {showAllReviews && (
        <ReviewModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowAllReviews(false)}
          initialStats={reviewStats || undefined}
        />
      )}
    </>
  );
}
```

## Product Grid Integration

**File:** `src/components/products/ProductGrid.tsx` (Integration Example)

```typescript
import React, { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { reviewService } from '../../services/reviews';
import type { Product } from '../../types/product';
import type { ReviewStats } from '../../types/reviews';

interface ProductWithReviews extends Product {
  reviewStats?: ReviewStats;
}

interface ProductGridProps {
  products: Product[];
  onPurchase?: (product: Product) => void;
}

export function ProductGrid({ products, onPurchase }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productsWithReviews, setProductsWithReviews] = useState<ProductWithReviews[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductsWithReviews();
  }, [products]);

  const loadProductsWithReviews = async () => {
    setLoading(true);
    
    try {
      // Load review stats for all products in parallel
      const reviewStatsPromises = products.map(async (product) => {
        try {
          const stats = await reviewService.getProductStats(product.id);
          return { ...product, reviewStats: stats };
        } catch (error) {
          console.error(`Error loading reviews for product ${product.id}:`, error);
          return { ...product }; // Return product without reviews on error
        }
      });

      const results = await Promise.all(reviewStatsPromises);
      setProductsWithReviews(results);
    } catch (error) {
      console.error('Error loading products with reviews:', error);
      setProductsWithReviews(products); // Fallback to products without reviews
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {productsWithReviews.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            reviewStats={product.reviewStats}
            onClick={() => setSelectedProduct(product)}
            onPurchase={onPurchase}
            loading={loading}
          />
        ))}
      </div>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onPurchase={onPurchase}
      />
    </>
  );
}
```

## Enhanced Product Card with Reviews

**File:** `src/components/products/ProductCard.tsx` (Integration Example)

```typescript
import React from 'react';
import { StarRating } from '../reviews/StarRating';
import type { Product } from '../../types/product';
import type { ReviewStats } from '../../types/reviews';

interface ProductCardProps {
  product: Product;
  reviewStats?: ReviewStats;
  onClick: () => void;
  onPurchase?: (product: Product) => void;
  loading?: boolean;
}

export function ProductCard({ product, reviewStats, onClick, onPurchase, loading }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price / 100);
  };

  const handlePurchaseClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening modal
    if (onPurchase) {
      onPurchase(product);
    }
  };

  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Product Image */}
      <div className="aspect-video bg-gray-700 relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Product Name */}
        <h3 className="font-semibold text-white truncate group-hover:text-secondary transition-colors">
          {product.name}
        </h3>

        {/* Review Stats */}
        {loading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-24" />
          </div>
        ) : reviewStats && reviewStats.totalReviews > 0 ? (
          <div className="flex items-center gap-2">
            <StarRating rating={reviewStats.averageRating} size="sm" />
            <span className="text-sm text-gray-400">
              ({reviewStats.totalReviews})
            </span>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No reviews yet</div>
        )}

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price and Purchase */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-lg font-bold text-secondary">
            {formatPrice(product.price)}
          </div>
          
          {onPurchase && (
            <button
              onClick={handlePurchaseClick}
              className="bg-secondary hover:bg-secondary-hover text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Buy Now
            </button>
          )}
        </div>

        {/* Creator */}
        {product.creator && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <div className="w-6 h-6 bg-gray-600 rounded-full flex-shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              by {product.creator.username || 'Unknown Creator'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Hook for Review Management

**File:** `src/hooks/useReviews.ts`

```typescript
import { useState, useEffect } from 'react';
import { reviewService } from '../services/reviews';
import type { ReviewStats, FormattedReview, ReviewFormData } from '../types/reviews';

export function useReviews(productId: string | null) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (productId) {
      loadReviews();
    } else {
      resetState();
    }
  }, [productId]);

  const resetState = () => {
    setStats(null);
    setReviews([]);
    setError('');
  };

  const loadReviews = async () => {
    if (!productId) return;

    setLoading(true);
    setError('');

    try {
      const [statsData, reviewsData] = await Promise.all([
        reviewService.getProductStats(productId),
        reviewService.getProductReviews(productId, 10, 0)
      ]);

      setStats(statsData);
      setReviews(reviewsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reviews';
      setError(errorMessage);
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (orderId: string, reviewData: ReviewFormData) => {
    if (!productId) throw new Error('Product ID is required');

    await reviewService.submitReview(orderId, productId, reviewData);
    
    // Reload reviews after successful submission
    await loadReviews();
  };

  const refetch = () => {
    if (productId) {
      loadReviews();
    }
  };

  return {
    stats,
    reviews,
    loading,
    error,
    submitReview,
    refetch
  };
}
```

This completes the integration examples showing how to properly integrate the review system into your existing pages and components. 