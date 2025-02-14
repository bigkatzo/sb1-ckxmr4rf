import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import type { Product } from '../../types';

interface ProductCardCompactProps {
  product: Product;
  onClick: (product: Product) => void;
  categoryIndex?: number;
  showCategory?: boolean;
}

export function ProductCardCompact({ 
  product, 
  onClick, 
  categoryIndex = 0,
  showCategory = false
}: ProductCardCompactProps) {
  const navigate = useNavigate();

  const handleCollectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.collectionSlug) {
      navigate(`/${product.collectionSlug}`);
    }
  };

  return (
    <div 
      onClick={() => onClick(product)}
      className="group relative bg-gray-900 rounded-lg overflow-hidden h-full hover:ring-1 hover:ring-purple-500/50 hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105"
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
      </div>
      
      <div className="p-2 sm:p-3">
        <h3 className="font-medium text-[11px] sm:text-sm text-white line-clamp-1">{product.name}</h3>
        {product.collectionSlug && product.collectionName && (
          <button
            onClick={handleCollectionClick}
            className="block text-[10px] sm:text-xs text-gray-400 hover:text-purple-400 transition-colors line-clamp-1 mt-0.5"
          >
            {product.collectionName}
          </button>
        )}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-white">
            {product.price} SOL
          </span>
          <BuyButton 
            product={product}
            price={product.price}
            disabled={product.stock === 0}
            className="z-10 scale-90 origin-right"
            onClick={(e) => {
              onClick(product);
            }}
          />
        </div>
      </div>
    </div>
  );
}