import { Image as ImageIcon } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import type { Product } from '../../types';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
  categoryIndex?: number;
  isInInitialViewport?: boolean;
}

export function ProductCard({ product, onClick, categoryIndex = 0, isInInitialViewport }: ProductCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const { modifiedPrice } = useModifiedPrice(product);

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="group relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500/50 hover:-translate-y-0.5 transition-all"
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
              onLoad={() => setImageLoading(false)}
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
      </div>
      
      <div className="p-3">
        <h3 className="font-medium text-sm text-white line-clamp-1">{product.name}</h3>
        
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {modifiedPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL
          </span>
          <BuyButton 
            product={product}
            disabled={product.stock === 0 && product.stock !== null}
            className="z-10 text-sm"
            onClick={handleClick}
          />
        </div>
      </div>
    </div>
  );
}