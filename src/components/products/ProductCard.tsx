import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { CategoryDiamond } from '../collections/CategoryDiamond';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
  categoryIndex?: number;
}

export function ProductCard({ product, onClick, categoryIndex = 0 }: ProductCardProps) {
  return (
    <div 
      onClick={() => onClick(product)}
      className="group relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500/50 hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-square overflow-hidden">
        {product.imageUrl ? (
          <OptimizedImage
            src={product.imageUrl}
            alt={product.name}
            width={600}
            height={600}
            quality={75}
            className="transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
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
            {product.price} SOL
          </span>
          <BuyButton 
            product={product}
            price={product.price}
            disabled={product.stock === 0}
            className="z-10"
            onClick={(e) => {
              onClick(product);
            }}
          />
        </div>
      </div>
    </div>
  );
}