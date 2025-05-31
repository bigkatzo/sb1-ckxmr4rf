import { useState, useRef, useEffect } from 'react';
import { ImageIcon, Ban, Pin } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { Card } from '../ui/Card';
import type { Product } from '../../types/variants';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
  categoryIndex?: number;
  isInInitialViewport?: boolean;
  loadingPriority?: number;
}

export function ProductCard({ product, onClick, categoryIndex = 0, isInInitialViewport, loadingPriority }: ProductCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { modifiedPrice } = useModifiedPrice({ product });
  
  // Check if sale has ended at any level
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;

  // Observe when card becomes visible to apply entrance animations
  useEffect(() => {
    if (!cardRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Wait a small amount of time proportional to loading priority
          // This creates a staggered entrance effect
          const delay = isInInitialViewport ? 0 : Math.min((loadingPriority || 0) * 50, 300);
          setTimeout(() => {
            setIsVisible(true);
            // Stop observing once visible
            observer.unobserve(entry.target);
          }, delay);
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(cardRef.current);
    
    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, [isInInitialViewport, loadingPriority]);

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    }
  };

  // Create a product object with explicitly set saleEnded properties to ensure
  // they're properly passed to the BuyButton
  const productWithExplicitSaleEnded = {
    ...product,
    saleEnded: product.saleEnded || false,
    categorySaleEnded: product.categorySaleEnded || false,
    collectionSaleEnded: product.collectionSaleEnded || false
  };

  return (
    <Card
      ref={cardRef}
      elevation={3}
      interactive
      onClick={handleClick}
      className={`product-card group relative
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      data-product-id={product.id}
      style={{ 
        transitionDelay: isInInitialViewport ? '0ms' : `${Math.min((loadingPriority || 0) * 50, 300)}ms`
      }}
    >
      <div className="relative aspect-square overflow-hidden">
        {product.imageUrl ? (
          <>
            <div 
              className={`
                absolute inset-0 bg-gradient-to-tr from-background-800 to-background-700
                ${imageLoading ? 'animate-pulse' : 'animate-none'}
              `}
            />
            <OptimizedImage
              src={product.imageUrl}
              alt={product.name}
              width={400}
              height={400}
              quality={80}
              className={`
                w-full h-full object-cover
                transition-all duration-300 will-change-transform
                group-hover:scale-105
                ${imageLoading ? 'opacity-0' : 'opacity-100'}
              `}
              sizes="(max-width: 640px) 50vw, 33vw"
              priority={isInInitialViewport}
              inViewport={isInInitialViewport}
              onLoad={() => setImageLoading(false)}
              loading={loadingPriority !== undefined ? (loadingPriority < 4 ? "eager" : "lazy") : undefined}
              fetchPriority={loadingPriority !== undefined ? 
                (loadingPriority < 2 ? "high" : 
                 loadingPriority < 8 ? "auto" : "low") : undefined
              }
            />
          </>
        ) : (
          <div className="w-full h-full bg-background-800 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted" />
          </div>
        )}
        {product.category && (
          <div className="absolute bottom-2 left-2 z-10">
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-error/10 text-error-light whitespace-nowrap">
              <Ban className="h-3 w-3" />
              Ended
            </span>
          </div>
        )}
        
        {/* Pin Badge - Add to the top right corner */}
        {product.pinOrder && (
          <div className="absolute top-2 right-2 z-10">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-secondary/20 text-secondary-light shadow-md">
              <Pin className="h-3 w-3" />
              <span className="font-bold">#{product.pinOrder}</span>
            </span>
          </div>
        )}
      </div>
      
      <div className="px-2.5 py-2">
        <h3 className="font-medium text-sm text-white line-clamp-1 group-hover:text-secondary transition-colors">{product.name}</h3>
        
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {modifiedPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL
          </span>
          <BuyButton 
            product={productWithExplicitSaleEnded}
            disabled={product.stock === 0 && product.stock !== null}
            className="z-10"
            onClick={handleClick}
          />
        </div>
      </div>
    </Card>
  );
}