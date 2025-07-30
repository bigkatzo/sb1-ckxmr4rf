import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, Ban } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { CollectionBadge } from '../ui/CollectionBadge';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import type { Product } from '../../types/variants';
import type { MerchantTier } from '../../types/collections';
import { useCurrency } from '../../contexts/CurrencyContext';
import { formatPrice } from '../../utils/formatters';
import { useSolanaPrice } from '../../utils/price-conversion';
interface ProductCardCompactProps {
  product: Product;
  onClick: (product: Product) => void;
  categoryIndex?: number;
  showCategory?: boolean;
  isInInitialViewport?: boolean;
  loadingPriority?: number;
  collectionMerchantTier?: MerchantTier;
}

export function ProductCardCompact({ 
  product, 
  onClick, 
  categoryIndex = 0,
  showCategory = false,
  isInInitialViewport = false,
  loadingPriority,
  collectionMerchantTier
}: ProductCardCompactProps) {
  const navigate = useNavigate();
  const { modifiedPrice } = useModifiedPrice({ product });
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [touchStartPosition, setTouchStartPosition] = useState<{x: number, y: number} | null>(null);
  const { currency } = useCurrency();
  const { price: solRate } = useSolanaPrice();
  
  const [displayPrice, setDisplayPrice] = useState<string>('');

  // ✅ Update displayPrice whenever currency or modifiedPrice changes
  useEffect(() => {
    let isMounted = true;
    const updatePrice = async () => {
      const formatted = await formatPrice(modifiedPrice, currency, product.baseCurrency, solRate);
      if (isMounted) setDisplayPrice(formatted);
    };
    updatePrice();
    return () => { isMounted = false; };
  }, [currency, modifiedPrice]);

  // Check if sale has ended at any level
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;

  // Create a product object with explicitly set saleEnded properties to ensure
  // they're properly passed to the BuyButton
  const productWithExplicitSaleEnded = {
    ...product,
    saleEnded: product.saleEnded || false,
    categorySaleEnded: product.categorySaleEnded || false,
    collectionSaleEnded: product.collectionSaleEnded || false
  };

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.collectionSlug) {
      navigate(`/${product.collectionSlug}`);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    }
  };

  // Touch event handlers for better mobile experience
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartTime(Date.now());
    setTouchStartPosition({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartTime || !touchStartPosition) return;
    
    // Calculate touch duration and distance
    const touchDuration = Date.now() - touchStartTime;
    const touchEndPosition = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
    
    const distance = Math.sqrt(
      Math.pow(touchEndPosition.x - touchStartPosition.x, 2) +
      Math.pow(touchEndPosition.y - touchStartPosition.y, 2)
    );
    
    // If it was a quick tap (less than 300ms) and didn't move much (less than 10px),
    // consider it a tap and trigger the click handler
    if (touchDuration < 300 && distance < 10) {
      handleClick();
    }
    
    // Reset touch state
    setTouchStartTime(null);
    setTouchStartPosition(null);
  };

  return (
    <div 
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group relative bg-gray-900 rounded-lg overflow-hidden h-full hover:ring-1 hover:ring-secondary/50 hover:-translate-y-0.5 transition-all cursor-pointer touch-manipulation"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {product.imageUrl ? (
          <OptimizedImage
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={300}
            quality={75}
            className="transition-transform duration-300 will-change-transform group-hover:scale-105"
            sizes="(max-width: 640px) 140px, 200px"
            inViewport={isInInitialViewport}
            priority={isInInitialViewport}
            loading={loadingPriority !== undefined ? (loadingPriority < 4 ? "eager" : "lazy") : undefined}
            fetchPriority={loadingPriority !== undefined ? 
              (loadingPriority < 2 ? "high" : 
               loadingPriority < 8 ? "auto" : "low") : undefined
            }
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </div>
        )}
        {showCategory && product.category && (
          <div className="absolute bottom-2 right-2 z-10">
            <CategoryDiamond 
              type={product.category.type}
              index={categoryIndex}
              selected
              size="sm"
              className="drop-shadow-lg"
            />
          </div>
        )}
        
        {/* Sale Ended Badge - Add to the top corner */}
        {isSaleEnded && (
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
              <Ban className="h-2.5 w-2.5" />
              Ended
            </span>
          </div>
        )}
      </div>
      
      <div className="p-2 sm:p-3">
        <h3 className="font-medium text-[11px] sm:text-sm text-white line-clamp-1">{product.name}</h3>
        {product.collectionSlug && product.collectionName && (
          <button
            onClick={handleCollectionClick}
            className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 hover:text-secondary transition-colors mt-0.5"
          >
            <span className="line-clamp-1">{product.collectionName}</span>
            <CollectionBadge 
              merchantTier={collectionMerchantTier} 
              className="text-xs sm:text-sm"
              showTooltip={false}
            />
          </button>
        )}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-white">
            {displayPrice}
          </span>
          <BuyButton 
            product={productWithExplicitSaleEnded}
            disabled={product.stock === 0 && product.stock !== null}
            className="z-10 text-[10px] sm:text-xs"
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              handleClick();
            }}
          />
        </div>
      </div>
    </div>
  );
}