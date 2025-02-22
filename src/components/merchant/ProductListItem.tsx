import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { CategoryTag } from '../ui/CategoryTag';
import { EditButton } from '../ui/EditButton';
import { DeleteButton } from '../ui/DeleteButton';
import type { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProductListItem({ product, onEdit, onDelete }: ProductListItemProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-2.5 sm:p-3 group">
      <div className="flex items-start gap-2 sm:gap-3">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-xs sm:text-sm truncate">{product.name}</h3>
              <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 mt-1">
                {product.description}
              </p>
              <div className="mt-2">
                <span className="inline-block bg-gray-800 text-xs px-2 py-1 rounded">
                  {product.sku}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <EditButton onClick={onEdit} className="scale-75 sm:scale-90" />
              )}
              {onDelete && (
                <DeleteButton onClick={onDelete} className="scale-75 sm:scale-90" />
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
            <span className="text-[10px] sm:text-xs font-medium">
              {product.price} SOL
            </span>
            <span className="text-[10px] sm:text-xs text-gray-400">
              {product.stock} in stock
            </span>
            {product.category && (
              <CategoryTag
                name={product.category.name}
                type={product.category.type}
                className="text-[10px] sm:text-xs scale-90"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}