import { useState } from 'react';
import { ImageIcon, Ban } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
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
  const { modifiedPrice } = useModifiedPrice({ product });
  
  // Check if sale has ended at any level
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="group relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-secondary/50 hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-square overflow-hidden">
        {product.imageUrl ? (
          <>
            <div 
              className={`
                absolute inset-0 bg-gray-800
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
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-600" />
          </div>
        )}
        {product.category && (
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 whitespace-nowrap">
              <Ban className="h-3 w-3" />
              Ended
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
            product={product}
            disabled={product.stock === 0 && product.stock !== null}
            className="z-10"
            onClick={handleClick}
          />
        </div>
      </div>
    </div>
  );
}