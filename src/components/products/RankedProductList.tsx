import React, { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, TrendingUp, Crown, Clock, Sparkles, Star, Zap } from 'lucide-react';
import { OptimizedImage } from '../ui/OptimizedImage';
import { CategoryDiamond } from '../collections/CategoryDiamond';
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

  // Load more items when the bottom of the list is in view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

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
      {hasMore && !loading && <div ref={loadMoreRef} className="h-4"></div>}
      
      {/* End of list */}
      {!hasMore && products.length > 0 && (
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

  // Get stock status text
  const getStockStatus = () => {
    if (product.stock === null) return 'Infinite';
    if (product.stock === 0) return 'Sold out';
    return `${product.stock}/${product.stock + (product.salesCount || 0)}`;
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
      if (rank === 1) return 'bg-purple-500 text-white';
      if (rank === 2) return 'bg-indigo-500 text-white';
      if (rank === 3) return 'bg-cyan-500 text-white';
      if (rank <= 10) return 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20';
    }
    return 'bg-gray-800 text-gray-400';
  };

  const getRankIcon = () => {
    if (type === 'sales') {
      if (rank === 1) return <Crown className="h-3 w-3" />;
      if (rank <= 3) return <TrendingUp className="h-3 w-3" />;
    } else {
      if (rank === 1) return <Sparkles className="h-3 w-3" />;
      if (rank === 2) return <Star className="h-3 w-3" />;
      if (rank === 3) return <Zap className="h-3 w-3" />;
    }
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
              className="hover:text-secondary truncate transition-colors"
            >
              {product.collectionName}
            </button>
          )}
        </div>
      </div>
      
      {/* Sales/launch info */}
      <div className="hidden sm:flex flex-col items-end mr-2 text-xs">
        {type === 'sales' ? (
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="h-3 w-3" />
            <span>{product.salesCount || 0} sales</span>
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