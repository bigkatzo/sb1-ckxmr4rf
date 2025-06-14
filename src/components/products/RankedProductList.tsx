import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, TrendingUp, Crown, Clock } from 'lucide-react';
import { OptimizedImage } from '../ui/OptimizedImage';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { CollectionBadge } from '../ui/CollectionBadge';
import { BuyButton } from './BuyButton';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import type { Product } from '../../types/index';
import type { Product as VariantsProduct } from '../../types/variants';

interface RankedProductListProps {
  products: Product[];
  categoryIndices: Record<string, number>;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  type: 'sales' | 'launch_date';
  showCollection?: boolean;
}

export function RankedProductList({ 
  products, 
  categoryIndices, 
  loading, 
  hasMore, 
  loadMore,
  type,
  showCollection = true
}: RankedProductListProps) {
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Load more when we're 200px from the bottom
  });
  
  // Track if we've already loaded more to prevent duplicate requests
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadAttempts = useRef(0);
  const MAX_LOAD_ATTEMPTS = 200; // Reasonable upper limit

  // Load more items when the bottom of the list is in view
  useEffect(() => {
    // Don't load more if:
    // 1. We're not in view
    // 2. There's no more data
    // 3. We're already loading
    // 4. We've exceeded our load attempt limit
    if (inView && hasMore && !loading && !isLoadingMore && loadAttempts.current < MAX_LOAD_ATTEMPTS) {
      setIsLoadingMore(true);
      loadAttempts.current += 1;
      
      // Add a small delay to prevent rapid consecutive calls
      setTimeout(() => {
        loadMore();
        setIsLoadingMore(false);
      }, 300);
    }
  }, [inView, hasMore, loading, loadMore, isLoadingMore]);

  // Reset load attempts when changing tabs
  useEffect(() => {
    loadAttempts.current = 0;
  }, [type]);

  if (products.length === 0 && !loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-400">No products found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map((product, index) => (
        <RankedProductItem 
          key={product.id} 
          product={product} 
          rank={index + 1} 
          categoryIndex={categoryIndices[product.categoryId] || 0}
          isTopTen={index < 10}
          type={type}
          showCollection={showCollection}
        />
      ))}
      
      {/* Loading state at the bottom */}
      {loading && (
        <div className="py-4 text-center">
          <div className="h-6 w-6 border-t-2 border-primary rounded-full animate-spin mx-auto"></div>
        </div>
      )}
      
      {/* Load more trigger */}
      {hasMore && !loading && loadAttempts.current < MAX_LOAD_ATTEMPTS && <div ref={loadMoreRef} className="h-4"></div>}
      
      {/* End of list */}
      {(!hasMore || loadAttempts.current >= MAX_LOAD_ATTEMPTS) && products.length > 0 && (
        <div className="py-4 text-center text-gray-400 text-sm">
          You've reached the end
        </div>
      )}
    </div>
  );
}

interface RankedProductItemProps {
  product: Product;
  rank: number;
  categoryIndex: number;
  isTopTen: boolean;
  type: 'sales' | 'launch_date';
  showCollection: boolean;
}

function RankedProductItem({ 
  product, 
  rank, 
  categoryIndex,
  isTopTen,
  type,
  showCollection
}: RankedProductItemProps) {
  const navigate = useNavigate();
  
  // Convert to VariantsProduct type for useModifiedPrice
  const variantsProduct: VariantsProduct = {
    ...product,
    visible: product.visible !== undefined ? product.visible : true
  };
  
  const { modifiedPrice } = useModifiedPrice({ product: variantsProduct });
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Check if sale has ended at any level
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;

  // Get stock status text - show "available/total" format
  const getStockStatus = () => {
    // Use either publicOrderCount or salesCount, preferring publicOrderCount
    const orderCount = product.publicOrderCount || product.salesCount || 0;
    
    if (product.stock === null) return 'Infinite';
    if (product.stock === 0) return 'Sold out';
    
    // Total stock comes directly from the database (product.stock)
    const totalStock = product.stock;
    
    // Available stock = Total stock - Sales count
    const availableStock = Math.max(0, totalStock - orderCount);
    
    // Display format: "available/total" (e.g., "492/500")
    return `${availableStock}/${totalStock}`;
  };

  // Handle click to navigate to product page
  const handleClick = () => {
    if (product.collectionSlug && product.slug) {
      navigate(`/${product.collectionSlug}/${product.slug}`);
    }
  };

  // Handle collection click
  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.collectionSlug) {
      navigate(`/${product.collectionSlug}`);
    }
  };

  // Determine rank badge color based on position and type
  const getRankBadgeStyles = () => {
    if (type === 'sales') {
      if (rank === 1) return 'bg-yellow-500 text-yellow-900';
      if (rank === 2) return 'bg-gray-300 text-gray-800';
      if (rank === 3) return 'bg-amber-600 text-amber-950';
      if (rank <= 10) return 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20';
    } else {
      // Use the same green style for all ranks 1-10 in new products tab
      if (rank <= 10) return 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20';
    }
    return 'bg-gray-800 text-gray-400';
  };

  const getRankIcon = () => {
    // Only show icons for sales tab
    if (type === 'sales') {
      if (rank === 1) return <Crown className="h-3 w-3" />;
      if (rank <= 3) return <TrendingUp className="h-3 w-3" />;
    }
    // Always return just the number for launch_date tab
    return null;
  };

  // Format the launch date if needed
  const formatLaunchDate = () => {
    if (!product.collectionLaunchDate) return 'Unknown';
    
    const date = new Date(product.collectionLaunchDate);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Sales count to display - use either publicOrderCount or salesCount
  const displaySalesCount = product.publicOrderCount || product.salesCount || 0;

  return (
    <div 
      ref={itemRef}
      onClick={handleClick}
      className={`
        relative flex items-center gap-3 p-2 sm:p-3 rounded-lg 
        hover:bg-gray-900/30 cursor-pointer transition-all
        ${isTopTen ? 'bg-gray-900/20' : 'bg-transparent'}
      `}
    >
      {/* Rank badge */}
      <div className={`
        flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 shrink-0 
        rounded-full font-medium text-xs sm:text-sm
        ${getRankBadgeStyles()}
      `}>
        {getRankIcon() || rank}
      </div>
      
      {/* Product image */}
      <div className="relative h-10 w-10 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-md">
        {product.imageUrl ? (
          <OptimizedImage
            src={product.imageUrl}
            alt={product.name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
            inViewport={true}
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-gray-600" />
          </div>
        )}
        
        {/* Sale ended indicator */}
        {isSaleEnded && (
          <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center">
            <div className="bg-red-500/80 text-white text-[8px] px-1 py-0.5 rounded">
              Ended
            </div>
          </div>
        )}
      </div>
      
      {/* Product details */}
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-medium text-sm sm:text-base text-white truncate">{product.name}</h3>
        
        <div className="flex items-center gap-x-1 mt-0.5 text-xs text-gray-400">
          {product.category && (
            <CategoryDiamond 
              type={product.category.type}
              index={categoryIndex}
              selected
              size="sm"
              className="mr-0.5"
            />
          )}
          
          {showCollection && product.collectionName && (
            <button 
              onClick={handleCollectionClick}
              className="flex items-center gap-1 hover:text-secondary transition-colors"
            >
              <span className="truncate">{product.collectionName}</span>
              <CollectionBadge 
                merchantTier={product.collectionOwnerMerchantTier} 
                className="text-xs"
                showTooltip={false}
              />
            </button>
          )}
        </div>
      </div>
      
      {/* Sales/launch info */}
      <div className="hidden sm:flex flex-col items-end mr-2 text-xs">
        {type === 'sales' ? (
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="h-3 w-3" />
            <span>{displaySalesCount} sales</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-blue-400">
            <Clock className="h-3 w-3" />
            <span>{formatLaunchDate()}</span>
          </div>
        )}
        
        <div className="text-gray-400 mt-0.5">
          Stock: {getStockStatus()}
        </div>
      </div>
      
      {/* Price and buy button */}
      <div className="flex flex-col items-end gap-1">
        <div className="text-sm font-medium text-white">
          {modifiedPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL
        </div>
        
        <BuyButton 
          product={variantsProduct}
          disabled={product.stock === 0 && product.stock !== null}
          className="text-xs py-1"
          onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling
            handleClick();
          }}
        />
      </div>
    </div>
  );
} 